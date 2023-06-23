<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Button, ShowHide } from 'svelte-pieces';
  import { dictionary } from '$lib/stores';
  import Header from '$lib/components/shell/Header.svelte';
</script>

<Header>
  {$_('batch-import.header', { default: 'Import to a Living Dictionary' })}
</Header>

<div class="max-w-screen-md ml-4">
  <div class="p-2">
    <h3
      class="mb-6 text-3xl leading-8 font-bold tracking-tight text-gray-900
        sm:text-4xl sm:leading-10">
      {$_('header.batch-import', {
        default: 'Batch Import',
      })}: {$dictionary.name}
    </h3>

    <p class="mb-3">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus convallis erat eu diam consectetur, vel bibendum ipsum mattis. Proin sed neque pellentesque leo scelerisque tempor in iaculis eros. Phasellus id urna quis tortor finibus feugiat. Nam vitae nisl hendrerit, porttitor enim quis, malesuada risus. Sed eu cursus nibh, at euismod orci. Pellentesque iaculis massa non ante sodales bibendum. Etiam ultricies ante eget bibendum tincidunt. Nunc fermentum porta purus. Nullam nec eros condimentum, ornare neque sed, aliquet erat. Sed vulputate quam ac venenatis volutpat. Aenean eget erat finibus, condimentum nibh quis, vestibulum sem. Proin dapibus laoreet fringilla. Proin vulputate leo lacus, quis dapibus ex bibendum finibus. Nunc sodales arcu nec dignissim scelerisque.
    </p>
    <p class="mb-3">
      Vestibulum suscipit, orci et convallis pharetra, ex augue eleifend sem, sit amet viverra nisl elit nec nulla. Proin vulputate laoreet vestibulum. Nulla malesuada massa in ligula luctus ultrices. Aliquam sagittis sapien eget ante sodales suscipit. Nulla a neque eget mauris posuere tincidunt sed sed diam. Vestibulum sit amet lobortis justo. Vestibulum at ex a libero eleifend ullamcorper nec at leo. Etiam ac mattis nisl. Praesent vulputate cursus blandit. Praesent pharetra congue ex, in volutpat purus feugiat ac. Duis id sodales lacus. Vestibulum egestas rhoncus auctor. Nunc sed ante ex. Nulla sollicitudin cursus vestibulum.
    </p>
  </div>
  <div class="flex justify-between">
    <Button form="filled" type="button" target="_blank" href="https://docs.google.com/spreadsheets/d/1Bqy1q_XZzlZLDM_glTxQ9gw0Pb5JEUssqQFtINxbwzY/edit#gid=1392642957">
      {$_('batch-import.template', { default: 'Link to Template' })}
    </Button>
    <ShowHide let:show let:toggle>
      <Button onclick={toggle}>
        <span class="lg:inline">
          <i class="far fa-comment" />
        </span>
        <span class="ml-1 sm:inline">
          {$_('header.contact_us', { default: 'Contact Us' })}
        </span>
      </Button>
      {#if show}
        {#await import('$lib/components/modals/Contact.svelte') then { default: Contact }}
          <Contact on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  </div>
</div>
