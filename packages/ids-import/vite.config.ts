import { UserConfig } from 'vite';

interface CustomUserConfig extends UserConfig {
  scriptId: string;
  root: string;
}

const config: CustomUserConfig = {
  plugins: [],
  root: process.env.DIEGO_ROOT_DIRECTORY,
  scriptId: process.env.SCRIPT_ID,
  // Other Vite configuration options...
};

export default config;
