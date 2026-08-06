export const colors = {
  ink: '#F6F3EA',
  panel: '#FFFEFA',
  panelSoft: '#EFEEE6',
  line: '#D8D6C9',
  gold: '#9AA37B',
  blue: '#788D69',
  lilac: '#879878',
  text: '#293624',
  muted: '#687067',
  green: '#6F875F',
  danger: '#B55F55',
  white: '#FFFFFF',
  cream: '#FBF9F3',
  sageWash: '#EEF1E7',
  oliveDark: '#536649',
} as const;

export const radius = {
  small: 12,
  medium: 16,
  large: 22,
  pill: 999,
} as const;

export const fonts = {
  display: 'Georgia',
  body: 'System',
} as const;

export const shadows = {
  card: {
    shadowColor: '#4F5747',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
} as const;
