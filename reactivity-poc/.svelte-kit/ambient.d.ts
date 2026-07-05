
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const SHELL: string;
	export const npm_command: string;
	export const COLORTERM: string;
	export const HYPRLAND_CMD: string;
	export const XDG_CONFIG_DIRS: string;
	export const XDG_SESSION_PATH: string;
	export const XDG_MENU_PREFIX: string;
	export const TERM_PROGRAM_VERSION: string;
	export const GUM_CONFIRM_PROMPT_FOREGROUND: string;
	export const COPILOT_DEBUG_NONCE: string;
	export const XDG_BACKEND: string;
	export const npm_config_npm_globalconfig: string;
	export const NODE: string;
	export const CF_R2_ACCESS_KEY: string;
	export const XDG_DATA_HOME: string;
	export const npm_config_verify_deps_before_run: string;
	export const GUM_CONFIRM_SELECTED_BACKGROUND: string;
	export const INPUT_METHOD: string;
	export const XCOMPOSEFILE: string;
	export const npm_config__jsr_registry: string;
	export const XDG_CONFIG_HOME: string;
	export const MEMORY_PRESSURE_WRITE: string;
	export const npm_config_strict_peer_dependencies: string;
	export const XMODIFIERS: string;
	export const DESKTOP_SESSION: string;
	export const HL_INITIAL_WORKSPACE_TOKEN: string;
	export const NO_AT_BRIDGE: string;
	export const XCURSOR_SIZE: string;
	export const npm_config_globalconfig: string;
	export const LAUNCH_EDITOR: string;
	export const EDITOR: string;
	export const XDG_SEAT: string;
	export const PWD: string;
	export const LOGNAME: string;
	export const XDG_SESSION_DESKTOP: string;
	export const XDG_SESSION_TYPE: string;
	export const OTTER_PATH: string;
	export const PNPM_HOME: string;
	export const SYSTEMD_EXEC_PID: string;
	export const VSCODE_GIT_ASKPASS_NODE: string;
	export const TERMINAL: string;
	export const QT_STYLE_OVERRIDE: string;
	export const MOTD_SHOWN: string;
	export const HOME: string;
	export const LANG: string;
	export const _JAVA_AWT_WM_NONREPARENTING: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const npm_package_version: string;
	export const MEMORY_PRESSURE_WATCH: string;
	export const STARSHIP_SHELL: string;
	export const WAYLAND_DISPLAY: string;
	export const __MISE_DIFF: string;
	export const BRAVE_API_KEY: string;
	export const CF_ACCOUNT_ID: string;
	export const MANROFFOPT: string;
	export const GIT_ASKPASS: string;
	export const XDG_SEAT_PATH: string;
	export const HF_TOKEN: string;
	export const INVOCATION_ID: string;
	export const pnpm_config_verify_deps_before_run: string;
	export const MANAGERPID: string;
	export const BAT_THEME: string;
	export const INIT_CWD: string;
	export const CHROME_DESKTOP: string;
	export const STARSHIP_SESSION_KEY: string;
	export const UWSM_WAIT_VARNAMES: string;
	export const QT_QPA_PLATFORM: string;
	export const __MISE_ORIG_PATH: string;
	export const XDG_CACHE_HOME: string;
	export const npm_lifecycle_script: string;
	export const VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
	export const VSCODE_PYTHON_AUTOACTIVATE_GUARD: string;
	export const SDL_IM_MODULE: string;
	export const CLAUDE_CODE_SSE_PORT: string;
	export const npm_config_min_release_age: string;
	export const XDG_SESSION_CLASS: string;
	export const ANDROID_HOME: string;
	export const TERM: string;
	export const npm_config_overrides: string;
	export const npm_package_name: string;
	export const npm_config_enable_pre_post_scripts: string;
	export const npm_config_approve_builds_automatically: string;
	export const USER: string;
	export const npm_config_frozen_lockfile: string;
	export const SDL_VIDEODRIVER: string;
	export const SUDO_EDITOR: string;
	export const VSCODE_GIT_IPC_HANDLE: string;
	export const OZONE_PLATFORM: string;
	export const __MISE_SESSION: string;
	export const HYPRLAND_INSTANCE_SIGNATURE: string;
	export const MANPAGER: string;
	export const npm_config_package_manager_strict_version: string;
	export const NOTIFY_SOCKET: string;
	export const DISPLAY: string;
	export const npm_lifecycle_event: string;
	export const SHLVL: string;
	export const MOZ_ENABLE_WAYLAND: string;
	export const CLAUDE_CODE_OAUTH_TOKEN_PERSONAL: string;
	export const CLOUDFLARE_API_TOKEN: string;
	export const npm_config_manage_package_manager_versions: string;
	export const QT_IM_MODULE: string;
	export const XDG_VTNR: string;
	export const XDG_SESSION_ID: string;
	export const MANAGERPIDFDID: string;
	export const npm_config_user_agent: string;
	export const PNPM_SCRIPT_SRC_DIR: string;
	export const XDG_STATE_HOME: string;
	export const npm_execpath: string;
	export const FC_FONTATIONS: string;
	export const XDG_RUNTIME_DIR: string;
	export const NODE_PATH: string;
	export const OTTER_EDITION: string;
	export const DEBUGINFOD_URLS: string;
	export const npm_package_json: string;
	export const npm_config_trust_downgrade: string;
	export const VSCODE_GIT_ASKPASS_MAIN: string;
	export const JOURNAL_STREAM: string;
	export const MISE_SHELL: string;
	export const XDG_DATA_DIRS: string;
	export const GDK_BACKEND: string;
	export const CAPACITOR_ANDROID_STUDIO_PATH: string;
	export const BROWSER: string;
	export const PATH: string;
	export const GDK_SCALE: string;
	export const npm_config_node_gyp: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const CF_R2_SECRET_KEY: string;
	export const MAIL: string;
	export const npm_config_registry: string;
	export const UWSM_FINALIZE_VARNAMES: string;
	export const GUM_CONFIRM_UNSELECTED_FOREGROUND: string;
	export const GUM_CONFIRM_UNSELECTED_BACKGROUND: string;
	export const npm_node_execpath: string;
	export const OLDPWD: string;
	export const GUM_CONFIRM_SELECTED_FOREGROUND: string;
	export const HYPRCURSOR_SIZE: string;
	export const CLAUDE_CODE_OAUTH_TOKEN_WORK: string;
	export const TERM_PROGRAM: string;
	export const NODE_ENV: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		SHELL: string;
		npm_command: string;
		COLORTERM: string;
		HYPRLAND_CMD: string;
		XDG_CONFIG_DIRS: string;
		XDG_SESSION_PATH: string;
		XDG_MENU_PREFIX: string;
		TERM_PROGRAM_VERSION: string;
		GUM_CONFIRM_PROMPT_FOREGROUND: string;
		COPILOT_DEBUG_NONCE: string;
		XDG_BACKEND: string;
		npm_config_npm_globalconfig: string;
		NODE: string;
		CF_R2_ACCESS_KEY: string;
		XDG_DATA_HOME: string;
		npm_config_verify_deps_before_run: string;
		GUM_CONFIRM_SELECTED_BACKGROUND: string;
		INPUT_METHOD: string;
		XCOMPOSEFILE: string;
		npm_config__jsr_registry: string;
		XDG_CONFIG_HOME: string;
		MEMORY_PRESSURE_WRITE: string;
		npm_config_strict_peer_dependencies: string;
		XMODIFIERS: string;
		DESKTOP_SESSION: string;
		HL_INITIAL_WORKSPACE_TOKEN: string;
		NO_AT_BRIDGE: string;
		XCURSOR_SIZE: string;
		npm_config_globalconfig: string;
		LAUNCH_EDITOR: string;
		EDITOR: string;
		XDG_SEAT: string;
		PWD: string;
		LOGNAME: string;
		XDG_SESSION_DESKTOP: string;
		XDG_SESSION_TYPE: string;
		OTTER_PATH: string;
		PNPM_HOME: string;
		SYSTEMD_EXEC_PID: string;
		VSCODE_GIT_ASKPASS_NODE: string;
		TERMINAL: string;
		QT_STYLE_OVERRIDE: string;
		MOTD_SHOWN: string;
		HOME: string;
		LANG: string;
		_JAVA_AWT_WM_NONREPARENTING: string;
		XDG_CURRENT_DESKTOP: string;
		npm_package_version: string;
		MEMORY_PRESSURE_WATCH: string;
		STARSHIP_SHELL: string;
		WAYLAND_DISPLAY: string;
		__MISE_DIFF: string;
		BRAVE_API_KEY: string;
		CF_ACCOUNT_ID: string;
		MANROFFOPT: string;
		GIT_ASKPASS: string;
		XDG_SEAT_PATH: string;
		HF_TOKEN: string;
		INVOCATION_ID: string;
		pnpm_config_verify_deps_before_run: string;
		MANAGERPID: string;
		BAT_THEME: string;
		INIT_CWD: string;
		CHROME_DESKTOP: string;
		STARSHIP_SESSION_KEY: string;
		UWSM_WAIT_VARNAMES: string;
		QT_QPA_PLATFORM: string;
		__MISE_ORIG_PATH: string;
		XDG_CACHE_HOME: string;
		npm_lifecycle_script: string;
		VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
		VSCODE_PYTHON_AUTOACTIVATE_GUARD: string;
		SDL_IM_MODULE: string;
		CLAUDE_CODE_SSE_PORT: string;
		npm_config_min_release_age: string;
		XDG_SESSION_CLASS: string;
		ANDROID_HOME: string;
		TERM: string;
		npm_config_overrides: string;
		npm_package_name: string;
		npm_config_enable_pre_post_scripts: string;
		npm_config_approve_builds_automatically: string;
		USER: string;
		npm_config_frozen_lockfile: string;
		SDL_VIDEODRIVER: string;
		SUDO_EDITOR: string;
		VSCODE_GIT_IPC_HANDLE: string;
		OZONE_PLATFORM: string;
		__MISE_SESSION: string;
		HYPRLAND_INSTANCE_SIGNATURE: string;
		MANPAGER: string;
		npm_config_package_manager_strict_version: string;
		NOTIFY_SOCKET: string;
		DISPLAY: string;
		npm_lifecycle_event: string;
		SHLVL: string;
		MOZ_ENABLE_WAYLAND: string;
		CLAUDE_CODE_OAUTH_TOKEN_PERSONAL: string;
		CLOUDFLARE_API_TOKEN: string;
		npm_config_manage_package_manager_versions: string;
		QT_IM_MODULE: string;
		XDG_VTNR: string;
		XDG_SESSION_ID: string;
		MANAGERPIDFDID: string;
		npm_config_user_agent: string;
		PNPM_SCRIPT_SRC_DIR: string;
		XDG_STATE_HOME: string;
		npm_execpath: string;
		FC_FONTATIONS: string;
		XDG_RUNTIME_DIR: string;
		NODE_PATH: string;
		OTTER_EDITION: string;
		DEBUGINFOD_URLS: string;
		npm_package_json: string;
		npm_config_trust_downgrade: string;
		VSCODE_GIT_ASKPASS_MAIN: string;
		JOURNAL_STREAM: string;
		MISE_SHELL: string;
		XDG_DATA_DIRS: string;
		GDK_BACKEND: string;
		CAPACITOR_ANDROID_STUDIO_PATH: string;
		BROWSER: string;
		PATH: string;
		GDK_SCALE: string;
		npm_config_node_gyp: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		CF_R2_SECRET_KEY: string;
		MAIL: string;
		npm_config_registry: string;
		UWSM_FINALIZE_VARNAMES: string;
		GUM_CONFIRM_UNSELECTED_FOREGROUND: string;
		GUM_CONFIRM_UNSELECTED_BACKGROUND: string;
		npm_node_execpath: string;
		OLDPWD: string;
		GUM_CONFIRM_SELECTED_FOREGROUND: string;
		HYPRCURSOR_SIZE: string;
		CLAUDE_CODE_OAUTH_TOKEN_WORK: string;
		TERM_PROGRAM: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
