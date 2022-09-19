<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let name: string,
    size = 1,
    required = false,
    disabled = false;

  function resize({ target }) {
    target.style.height = '1px';
    target.style.height = +target.scrollHeight + 'px';
  }

  function autoresize(el: HTMLTextAreaElement) {
    resize({ target: el });
    el.addEventListener('input', resize);

    return {
      destroy: () => el.removeEventListener('input', resize),
    };
  }
</script>

<div
  class:disabled
  class:sompeng={name === 'Sompeng-Mardir'}
  class="field"
  style="--font-size: {size}rem;">
  <textarea
    style={size > 1 && 'font-weight: bold;'}
    type="text"
    rows="1"
    {name}
    {required}
    {disabled}
    on:input={(e) => {
      //@ts-ignore
      dispatch('input', e.target.value.trim());
    }}
    use:autoresize
    on:keyup={(e) => {
      if (e.code === 'Enter') {
        dispatch('submit');
      }
    }}
    autocomplete="false" />
  <!-- svelte-ignore a11y-label-has-associated-control -->
  <label>{name}</label>
</div>

<style>
  * {
    line-height: initial;
  }
  .field {
    --text-color: #afafaf;
    width: 100%;
    position: relative;
    border-bottom: 2px dashed var(--text-color);
    padding-top: var(--font-size);
    transition: 400ms;
  }
  .field:focus-within {
    border-bottom: 2px solid navy;
  }
  .field.disabled {
    border-bottom: none;
  }

  textarea {
    outline: none;
    border: none;
    overflow: hidden;
    margin: 0;
    width: 100%;
    padding: 0.25rem 0;
    background: none;
    font-size: var(--font-size);
    resize: none;
    transition: border 400ms;
  }
  textarea:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  label {
    color: var(--text-color);
    font-size: var(--font-size);
    /* animation */
    z-index: -1;
    position: absolute;
    top: calc(4px + var(--font-size));
    left: 0;
    transform-origin: 0%;
    transition: all 400ms;
  }

  .field:focus-within label,
  textarea:not(:placeholder-shown) + label {
    transform: scale(0.75);
    opacity: 1;
    top: 0px;
  }
</style>
