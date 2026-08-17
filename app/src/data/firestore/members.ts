import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { getDb, workspaceId } from '../firebase/client';
import type { Role } from '../../domain/enums';

/**
 * Membros e convites.
 *
 * Tudo aqui é do proprietário — as Security Rules restringem `list` de members
 * e de invitations a ele, e o mesmo para criar, alterar e revogar. Este módulo
 * não é a proteção; ele apenas não tenta contorná-la.
 *
 * Um convite não concede acesso: ele autoriza que uma pessoa, entrando com
 * aquele e-mail, crie o próprio documento de membro. Quem confere que o
 * convite existe, é do mesmo endereço, tem o papel declarado, está pendente e
 * não expirou são as Rules, no momento em que o membro é criado.
 *
 * Nenhum e-mail sai daqui. O sistema roda no plano gratuito, sem Cloud
 * Functions, e avisar a pessoa é ato humano — a tela diz isso, para ninguém
 * ficar esperando uma mensagem que não existe.
 */

/** Os papéis que se pode conceder. 'owner' não entra: não se convida proprietário. */
export const PAPEIS_CONVIDAVEIS: Role[] = ['admin', 'editor', 'reviewer', 'viewer', 'external_partner'];

export interface Membro {
  uid: string;
  email: string;
  role: Role;
  status: string;
  createdAt: Date | null;
}

export interface Convite {
  id: string;
  email: string;
  role: Role;
  status: string;
  expiresAt: Date | null;
  createdAt: Date | null;
  /** true quando pendente e ainda dentro da validade. */
  vigente: boolean;
}

function base(): string {
  return `workspaces/${workspaceId()}`;
}

function paraData(v: unknown): Date | null {
  return v && typeof (v as { toDate?: unknown }).toDate === 'function'
    ? (v as { toDate: () => Date }).toDate()
    : null;
}

export async function listarMembros(): Promise<Membro[]> {
  const snap = await getDocs(collection(getDb(), `${base()}/members`));
  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        uid: d.id,
        email: String(x.email ?? ''),
        role: String(x.role ?? 'viewer') as Role,
        status: String(x.status ?? 'active'),
        createdAt: paraData(x.createdAt),
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email, 'pt-BR'));
}

export async function listarConvites(): Promise<Convite[]> {
  const agora = Date.now();
  const snap = await getDocs(collection(getDb(), `${base()}/invitations`));
  return snap.docs
    .map((d) => {
      const x = d.data();
      const expiresAt = paraData(x.expiresAt);
      const status = String(x.status ?? 'pending');
      return {
        id: d.id,
        email: String(x.email ?? ''),
        role: String(x.role ?? 'viewer') as Role,
        status,
        expiresAt,
        createdAt: paraData(x.createdAt),
        vigente: status === 'pending' && (expiresAt?.getTime() ?? 0) > agora,
      };
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export interface ConvidarInput {
  email: string;
  role: Role;
  dias: number;
  actorUid: string;
  membros: Membro[];
  convites: Convite[];
}

export async function convidar(input: ConvidarInput): Promise<{ id: string }> {
  const email = input.email.trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(`"${input.email}" não é um endereço de e-mail válido.`);
  }
  if (!PAPEIS_CONVIDAVEIS.includes(input.role)) {
    throw new Error('Papel inválido. Proprietário não se concede por convite.');
  }
  if (!Number.isInteger(input.dias) || input.dias < 1 || input.dias > 30) {
    throw new Error('A validade deve ser de 1 a 30 dias. Convite sem prazo é acesso sem prazo.');
  }

  // Duas autorizações vivas para a mesma pessoa deixam ambíguo qual papel vale.
  const jaMembro = input.membros.find((m) => m.email.toLowerCase() === email);
  if (jaMembro) {
    throw new Error(`${email} já é membro, com papel "${jaMembro.role}".`);
  }
  const pendente = input.convites.find((c) => c.email.toLowerCase() === email && c.vigente);
  if (pendente) {
    throw new Error(
      `Já existe convite pendente para ${email}, papel "${pendente.role}". Revogue-o antes de emitir outro.`,
    );
  }

  const db = getDb();
  const wid = workspaceId();
  const ref = doc(collection(db, `${base()}/invitations`));
  const expiraEm = Timestamp.fromMillis(Date.now() + input.dias * 24 * 3600 * 1000);

  const batch = writeBatch(db);
  batch.set(ref, {
    id: ref.id,
    workspaceId: wid,
    email,
    role: input.role,
    status: 'pending',
    expiresAt: expiraEm,
    createdAt: serverTimestamp(),
    acceptedAt: null,
    acceptedByUid: null,
  });

  // Convite é ato de governança: entra na auditoria como qualquer outro.
  const eventoRef = doc(collection(db, `${base()}/auditEvents`));
  batch.set(eventoRef, {
    id: eventoRef.id,
    workspaceId: wid,
    entityCollection: 'invitations',
    entityId: ref.id,
    action: 'create',
    actorUid: input.actorUid,
    actorRole: 'owner',
    occurredAt: serverTimestamp(),
    reason: `Convite para ${email} com papel ${input.role}, válido por ${input.dias} dia(s)`,
    changedFields: ['email', 'role', 'status', 'expiresAt'],
    toVersion: 1,
    correlationId: ref.id,
    source: 'web',
  });

  await batch.commit();
  return { id: ref.id };
}

/**
 * Revoga um convite apagando-o.
 *
 * Apagar, e não marcar como revogado, é o que as Rules permitem ao
 * proprietário — e o rastro não se perde: a criação ficou na auditoria, que é
 * append-only, e a revogação entra lá também.
 */
export async function revogarConvite(id: string, email: string, actorUid: string): Promise<void> {
  const db = getDb();
  const wid = workspaceId();
  const eventoRef = doc(collection(db, `${base()}/auditEvents`));

  // O evento vai ANTES da exclusão, e em duas escritas, não num lote.
  //
  // A ordem é a parte que importa: se a segunda escrita falhar, sobra um evento
  // de revogação para um convite que continua de pé — visível, conferível e
  // corrigível. Na ordem inversa, sobraria um convite sumido sem explicação, e
  // ninguém procura o que não sabe que existiu.
  await setDoc(eventoRef, {
    id: eventoRef.id,
    workspaceId: wid,
    entityCollection: 'invitations',
    entityId: id,
    action: 'delete',
    actorUid,
    actorRole: 'owner',
    occurredAt: serverTimestamp(),
    reason: `Convite para ${email} revogado antes do aceite`,
    changedFields: ['status'],
    toVersion: 1,
    correlationId: id,
    source: 'web',
  });

  await deleteDoc(doc(db, `${base()}/invitations/${id}`));
}

/** Suspende ou reativa um membro. O proprietário não muda o próprio estado. */
export async function alterarStatusDoMembro(
  uid: string,
  status: 'active' | 'suspended',
  actorUid: string,
): Promise<void> {
  if (uid === actorUid) {
    throw new Error('Você não altera o próprio acesso — é o que impede o sistema de ficar sem dono.');
  }
  await updateDoc(doc(getDb(), `${base()}/members/${uid}`), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
  });
}
