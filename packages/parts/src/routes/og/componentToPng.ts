import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { html as toReactNode } from 'satori-html';

// Vite plugin turns import into the result of fs.readFileSync during build
import notoSans from './notoSans.ttf';

export async function componentToPng(component, props, height: number, width: number) {
	const result = component.render(props);
	const markup = toReactNode(`${result.html}<style>${result.css.code}</style>`);
	const svg = await satori(markup, {
		fonts: [
			{
				name: 'Noto Sans',
				data: Buffer.from(notoSans),
				style: 'normal'
			}
		],
		height,
		width,
	});

	const resvg = new Resvg(svg, {
		fitTo: {
			mode: 'width',
			value: width
		}
	});

	const image = resvg.render();

	return new Response(image.asPng(), {
		headers: {
			'content-type': 'image/png'
		}
	});
}
