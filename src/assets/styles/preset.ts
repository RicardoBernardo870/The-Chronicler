import { definePreset } from '@primeuix/themes'
import Lara from '@primeuix/themes/lara'

/**
 * Liquid Glass preset — extends Lara Dark with glassmorphism tokens.
 *
 * Surfaces use semi-transparent RGBA backgrounds so that backdrop-filter
 * blur renders correctly. The CSS variables --glass-blur and
 * --glass-brightness are consumed by glass.css utilities.
 */
const ChroniclerPreset = definePreset(Lara, {
  semantic: {
    primary: {
      50:  '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },
    colorScheme: {
      dark: {
        surface: {
          0:   'rgba(255, 255, 255, 0.03)',
          50:  'rgba(255, 255, 255, 0.05)',
          100: 'rgba(255, 255, 255, 0.07)',
          200: 'rgba(255, 255, 255, 0.09)',
          300: 'rgba(255, 255, 255, 0.12)',
          400: 'rgba(255, 255, 255, 0.16)',
          500: 'rgba(255, 255, 255, 0.20)',
          600: 'rgba(255, 255, 255, 0.25)',
          700: 'rgba(255, 255, 255, 0.30)',
          800: 'rgba(255, 255, 255, 0.40)',
          900: 'rgba(255, 255, 255, 0.55)',
          950: 'rgba(255, 255, 255, 0.70)',
        },
        content: {
          background: 'rgba(18, 18, 28, 0.55)',
          hoverBackground: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.10)',
          color: '{text.color}',
          hoverColor: '{text.hover.color}',
        },
      },
      light: {
        surface: {
          0:   'rgba(255, 255, 255, 0.85)',
          50:  'rgba(248, 250, 252, 0.80)',
          100: 'rgba(241, 245, 249, 0.75)',
          200: 'rgba(226, 232, 240, 0.70)',
          300: 'rgba(203, 213, 225, 0.65)',
          400: 'rgba(148, 163, 184, 0.60)',
          500: 'rgba(100, 116, 139, 0.55)',
          600: 'rgba(71, 85, 105, 0.50)',
          700: 'rgba(51, 65, 85, 0.45)',
          800: 'rgba(30, 41, 59, 0.40)',
          900: 'rgba(15, 23, 42, 0.35)',
          950: 'rgba(2, 6, 23, 0.30)',
        },
        content: {
          background: 'rgba(255, 255, 255, 0.65)',
          hoverBackground: 'rgba(0, 0, 0, 0.04)',
          borderColor: 'rgba(0, 0, 0, 0.08)',
          color: '{text.color}',
          hoverColor: '{text.hover.color}',
        },
      },
    },
  },
})

export default ChroniclerPreset
