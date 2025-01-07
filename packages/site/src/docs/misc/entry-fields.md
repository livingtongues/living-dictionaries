# Entry Fields

## Gloss

### Glosses containing scientific names

In these cases, when scientific names are italicized by convention we need to create a specific field for scientific names, such as many entries in [Birhor's Plants domain](https://livingdictionaries.app/birhor/entries)

## Interlinearization
- Consider researching more about [Leipzig glossing](https://ctan.org/pkg/leipzig?lang=en)
- Need to be able to support small-caps, used and [Unicode Lookup](https://unicode.emnudge.dev/) to find characters.
- Can be done via rich-text as in `3sg.<span style="font-variant: small-caps;">pres</span>` or via specific small capitals unicode letters like done in [Toggle SmallCaps](https://svelte.dev/repl/231af5758d6b484dbbee7827b0b95540?version=3.46.4) to come up with "3sg.ᴘʀᴇꜱ" these can actually be typed/pasted into this text box that text doesn't support smallCaps in the rich-text sort of manner. The benefit of doing this via unicode is that we can export dictionaries with the smallCaps intact, as well as people can copy paste into and out of the site and keep the small caps intact. This is a topic to research more on as small caps q is not contained in common fonts and may need a font added. https://en.wikipedia.org/wiki/Small_caps and https://yaytext.com/small-caps/#preview_small-caps are good resources. See also https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-caps

?? What about other rich-text features?

## Notes

Is there a need for rich-text and which ones? If so use [QuillJs](https://quilljs.com) as it's 1/3 the weight of CKEditor:
- [Quill in Svelte demo](https://svelte.dev/repl/e2bbe94abb19419892442729752ee308?version=3.19.1)
- [Bubble and scrolling quill demo](https://quilljs.com/playground/#autogrow-height)
- [svelte-quill action](https://github.com/kevmodrome/svelte-quill/blob/master/src/main.js)

## Fields to add

### Scientific Name

- for Latin names that are normally italicized - do we need to support italics as optional here using *italics* or not - if so we can do them using something like https://svelte.dev/examples/textarea-inputs
