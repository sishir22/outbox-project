import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#00aa55',
          hover: '#009248',
          light: '#e6f7ef',
        },
        sidebar: '#fbfbfb',
        borderLight: '#ebebeb',
      },
    },
  },
  plugins: [],
};
export default config;
