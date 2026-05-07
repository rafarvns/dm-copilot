// Helper central para ícones SVG (Lucide). Substitui emojis-como-ícone na UI.
// Importes nomeados garantem tree-shaking — só os ícones listados entram no bundle.

import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Camera,
  Castle,
  Check,
  CheckCircle2,
  Circle,
  CircleStop,
  CircleX,
  Clock,
  CopyPlus,
  Crown,
  Dices,
  Drama,
  Eye,
  Flag,
  Flame,
  FolderOpen,
  Globe,
  Heart,
  Home,
  Hourglass,
  Image,
  Info,
  Map,
  MapPin,
  MonitorPlay,
  Music,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Skull,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  WandSparkles,
  X,
  Zap,
  createElement,
} from "lucide";

const ICONS = {
  "arrow-down-up": ArrowDownUp,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "book-open": BookOpen,
  calendar: Calendar,
  camera: Camera,
  castle: Castle,
  check: Check,
  "check-circle-2": CheckCircle2,
  circle: Circle,
  "circle-stop": CircleStop,
  "circle-x": CircleX,
  clock: Clock,
  "copy-plus": CopyPlus,
  crown: Crown,
  dices: Dices,
  drama: Drama,
  eye: Eye,
  flag: Flag,
  flame: Flame,
  "folder-open": FolderOpen,
  globe: Globe,
  heart: Heart,
  home: Home,
  hourglass: Hourglass,
  image: Image,
  info: Info,
  map: Map,
  "map-pin": MapPin,
  "monitor-play": MonitorPlay,
  music: Music,
  "notebook-pen": NotebookPen,
  pencil: Pencil,
  plus: Plus,
  "refresh-cw": RefreshCw,
  save: Save,
  "scroll-text": ScrollText,
  search: Search,
  settings: Settings,
  shield: Shield,
  "shield-alert": ShieldAlert,
  "shield-check": ShieldCheck,
  skull: Skull,
  sparkles: Sparkles,
  swords: Swords,
  "trash-2": Trash2,
  upload: Upload,
  user: User,
  "user-plus": UserPlus,
  users: Users,
  "wand-sparkles": WandSparkles,
  x: X,
  zap: Zap,
};

function buildSvg(node, { size, strokeWidth, className }) {
  const [tag, attrs, children] = node;
  const merged = {
    ...attrs,
    width: size,
    height: size,
    "stroke-width": strokeWidth,
  };
  const classes = ["icon"];
  if (className) {
    className
      .split(" ")
      .map((c) => c.trim())
      .filter(Boolean)
      .forEach((c) => classes.push(c));
  }
  merged.class = classes.join(" ");
  return createElement([tag, merged, children]);
}

// Retorna string SVG pronta para uso em template literals.
// Exemplo: `<button>${icon("pencil")} Editar</button>`
export function icon(name, options = {}) {
  const node = ICONS[name];
  if (!node) {
    console.warn(`[icons] desconhecido: ${name}`);
    return "";
  }
  const { size = 16, strokeWidth = 2, className = "" } = options;
  return buildSvg(node, { size, strokeWidth, className }).outerHTML;
}

// Substitui placeholders <i data-icon="..."> por <svg> reais dentro de root.
// Idempotente — adiciona data-icon-mounted ao SVG resultante para evitar re-conversão.
// Copia as classes do <i> original para o <svg>, preservando .btn__icon, .sidebar__link-icon, etc.
export function mountIcons(root = document) {
  const placeholders = root.querySelectorAll("[data-icon]:not([data-icon-mounted])");
  placeholders.forEach((el) => {
    const name = el.getAttribute("data-icon");
    const node = ICONS[name];
    if (!node) {
      console.warn(`[icons] desconhecido: ${name}`);
      return;
    }
    const size = Number(el.getAttribute("data-size")) || 16;
    const strokeWidth = Number(el.getAttribute("data-stroke-width")) || 2;
    const inheritedClasses = Array.from(el.classList).join(" ");
    const svg = buildSvg(node, {
      size,
      strokeWidth,
      className: inheritedClasses,
    });
    svg.setAttribute("data-icon-mounted", "true");
    el.replaceWith(svg);
  });
}
