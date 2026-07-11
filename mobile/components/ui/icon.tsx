import {
  ArrowLeft,
  Bot,
  Brain,
  ChartBar,
  ChartPie,
  Check,
  CircleCheckBig,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  Download,
  Droplet,
  FileText,
  House,
  Info,
  Lock,
  Mail,
  Pencil,
  RefreshCw,
  Send,
  Settings,
  Shield,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react-native';

// Web版(material-symbols-outlined)のアイコン名文字列をそのまま受け取り、
// lucide-react-nativeのコンポーネントにマッピングする変換層。
// 画面移植時にIconの呼び出し方(name/filled)を書き換えずに済むようにするため。
const ICONS: Record<string, LucideIcon> = {
  home: House,
  edit: Pencil,
  donut_large: ChartPie,
  bar_chart: ChartBar,
  description: FileText,
  settings: Settings,
  mail: Mail,
  error: CircleAlert,
  arrow_back: ArrowLeft,
  check: Check,
  check_circle: CircleCheckBig,
  chevron_right: ChevronRight,
  expand_less: ChevronUp,
  expand_more: ChevronDown,
  smart_toy: Bot,
  send: Send,
  shield: Shield,
  water_drop: Droplet,
  close: X,
  refresh: RefreshCw,
  info: Info,
  lock: Lock,
  download: Download,
  delete_forever: Trash2,
  warning: TriangleAlert,
  psychiatry: Brain,
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  filled?: boolean;
}

export function Icon({ name, size = 22, color = '#18130A', filled = false }: IconProps) {
  const LucideIconComponent = ICONS[name];
  if (!LucideIconComponent) return null;
  return (
    <LucideIconComponent
      size={size}
      color={color}
      fill={filled ? color : 'none'}
      strokeWidth={2}
    />
  );
}
