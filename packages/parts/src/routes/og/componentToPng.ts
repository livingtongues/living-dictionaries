import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { html as toReactNode } from 'satori-html';

// Vite plugin turns import into the result of fs.readFileSync during build
import NotoSans from './notoSans.ttf';
import type { SvelteComponent } from 'svelte';
// import NotoSansRegular from './NotoSans-Regular.ttf';

// based on what text is contained in the props, load fonts accordingly

const getPng = withCache(async (html: string, height: number, width: number) => {
	const markup = toReactNode(html);
	const svg = await satori(markup, {
		fonts: [
			{
				name: 'Noto+Sans',
				data: Buffer.from(NotoSans),
				style: 'normal'
			},
		],
		// debug: true,
		height,
		width,
		loadAdditionalAsset: (...args: string[]) => loadDynamicAsset(...args),
	});

	const resvg = new Resvg(svg, {
		fitTo: {
			mode: 'width',
			value: width
		}
	});

	return resvg.render().asPng();
});

export async function componentToPng(component: typeof SvelteComponent, props, height: number, width: number) {
	const result = (component as any).render(props);
	const png = await getPng(result.html, height, width);
	return new Response(png, {
		headers: {
			'content-type': 'image/png',
			'cache-control': 'public, immutable, no-transform, max-age=31536000',
		}
	});
}

// @TODO: Cover most languages with Noto Sans.
const languageFontMap = {
	zh: 'Noto+Sans+SC',
	ja: 'Noto+Sans+JP',
	ko: 'Noto+Sans+KR',
	th: 'Noto+Sans+Thai',
	he: 'Noto+Sans+Hebrew',
	ar: 'Noto+Sans+Arabic',
	bn: 'Noto+Sans+Bengali',
	ta: 'Noto+Sans+Tamil',
	te: 'Noto+Sans+Telugu',
	ml: 'Noto+Sans+Malayalam',
	devanagari: 'Noto+Sans+Devanagari',
	kannada: 'Noto+Sans+Kannada',
	symbol: ['Noto+Sans+Symbols', 'Noto+Sans+Symbols+2'],
	math: 'Noto+Sans+Math',
	unknown: 'Noto+Sans',
};
type LanguageCode = keyof typeof languageFontMap;

const loadDynamicAsset = withCache(
	async (code: LanguageCode, text: string) => {
		// Try to load from Google Fonts.
		let names = languageFontMap[code];
		if (!names) code = 'unknown';

		try {
			if (typeof names === 'string') {
				names = [names];
			}

			for (const name of names) {
				const API = `https://fonts.googleapis.com/css2?family=${name}&text=${encodeURIComponent(text)}`;

				const css = await (
					await fetch(API, {
						headers: {
							// Make sure it returns TTF.
							'User-Agent':
								'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
						},
					})
				).text();

				const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);

				if (!resource) return;

				const res = await fetch(resource[1]);
				if (res.status === 200) {
					const font = await res.arrayBuffer();
					return {
						name: `satori_${code}_fallback_${text}`,
						data: font,
						weight: 400,
						style: 'normal',
					};
				}
			}
		} catch (e) {
			console.error('Failed to load dynamic font for', text, '. Error:', e);
		}
	}
);

// eslint-disable-next-line @typescript-eslint/ban-types
function withCache(fn: Function) {
	const cache = new Map();
	return async (...args: string[]) => {
		const key = hash(args.join());
		if (cache.has(key)) return cache.get(key);
		const result = await fn(...args);
		cache.set(key, result);
		return result;
	};
}

function hash(str: string) {
  let i; let l;
  let hval = 0x811C9DC5;

  for (i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  return (`00000${(hval >>> 0).toString(36)}`).slice(-6);
}