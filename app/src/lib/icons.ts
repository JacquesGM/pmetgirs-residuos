import {
  BarChart3,
  CalendarClock,
  Droplets,
  Factory,
  Flame,
  GraduationCap,
  HeartHandshake,
  Home,
  Landmark,
  MapPin,
  Recycle,
  Scale,
  ShieldCheck,
  Sprout,
  Sun,
  Target,
  Trash2,
  Truck,
  User,
  type LucideIcon,
} from 'lucide-react';

export const eixoIcons: Record<string, LucideIcon> = {
  'governanca-marco-legal': Scale,
  'dados-indicadores-transparencia': BarChart3,
  'coleta-domiciliar-seletiva': Trash2,
  'logistica-estacoes-transferencia': Truck,
  'triagem-reciclagem': Recycle,
  'inclusao-cooperativas': HeartHandshake,
  'tratamento-fracao-organica': Sprout,
  'recuperacao-energetica': Flame,
  'remediacao-passivos': ShieldCheck,
  'energia-solar': Sun,
  'educacao-ambiental': GraduationCap,
  'lixo-flutuante-corpos-hidricos': Droplets,
};

export const indicadorIcons: Record<string, LucideIcon> = {
  'municipios-abrangidos': MapPin,
  'geracao-rsu-diaria': Trash2,
  'geracao-rsu-anual': Trash2,
  'geracao-per-capita': User,
  'usinas-triagem': Factory,
  'areas-remediacao': ShieldCheck,
  'unidades-termicas': Flame,
  'cronograma-referencia': CalendarClock,
};

export const metaIcons: Record<string, LucideIcon> = {
  'coleta-domiciliar-universal': Home,
  'coleta-seletiva-50': Recycle,
  'coleta-seletiva-75': Recycle,
  'coleta-seletiva-100': Recycle,
  'areas-dificil-acesso': Target,
};

export function iconFor(map: Record<string, LucideIcon>, id: string): LucideIcon {
  return map[id] ?? Landmark;
}
