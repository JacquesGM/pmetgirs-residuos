import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getAuthClient, getDb, initAppCheck, workspaceId } from '../data/firebase/client';
import type { Role } from '../domain/enums';

/**
 * Estado de acesso da área de gestão.
 *
 * ATENÇÃO — este provedor decide o que APARECER, não o que é PERMITIDO.
 * A autorização real é avaliada pelas Security Rules, no servidor. Um usuário
 * que contorne esta camada no navegador continua sem ler um único documento.
 * Nunca mova uma decisão de segurança para cá.
 */

export interface Membership {
  uid: string;
  email: string;
  role: Role;
  status: 'active' | 'suspended' | 'revoked';
  displayName: string | null;
  photoURL: string | null;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  /** Autenticado no Google, mas sem convite aceito neste workspace. */
  | { status: 'no_membership'; user: User }
  | { status: 'suspended'; user: User }
  | { status: 'active'; user: User; membership: Membership };

interface AuthContextValue {
  state: AuthState;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  /** Conveniência de interface. A regra de verdade está nas Security Rules. */
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    initAppCheck();
    const auth = getAuthClient();

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ status: 'signed_out' });
        return;
      }

      try {
        const snapshot = await getDoc(doc(getDb(), `workspaces/${workspaceId()}/members/${user.uid}`));
        if (!snapshot.exists()) {
          setState({ status: 'no_membership', user });
          return;
        }

        const data = snapshot.data() as Omit<Membership, 'uid'>;
        if (data.status !== 'active') {
          setState({ status: 'suspended', user });
          return;
        }

        setState({
          status: 'active',
          user,
          membership: {
            uid: user.uid,
            email: data.email,
            role: data.role,
            status: data.status,
            displayName: user.displayName,
            photoURL: user.photoURL,
          },
        });
      } catch {
        // As Rules recusam a leitura de quem não é membro. A recusa é a
        // resposta esperada aqui, não um erro a ser exibido.
        setState({ status: 'no_membership', user });
      }
    });
  }, []);

  const signIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    // Força a escolha da conta: em máquina compartilhada, entrar em silêncio
    // com a sessão de outra pessoa é um risco real.
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(getAuthClient(), provider);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(getAuthClient());
  }, []);

  const hasRole = useCallback(
    (roles: Role[]) => state.status === 'active' && roles.includes(state.membership.role),
    [state],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, signOutUser, hasRole }),
    [state, signIn, signOutUser, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return context;
}
