<h1>Lazily-created store × <code>$derived</code> POC</h1>
<p>
  Reproduces living-dictionaries' <code>.issues/dict-table-accessor-rows-reactivity.md</code>:
  a table store whose <code>$state</code> is lazily created on first read silently loses
  reactivity for the <code>$derived</code> that triggered the creation.
</p>
<ul>
  <li><a href="/broken">/broken</a> — store constructed inside the consuming reaction (current pattern)</li>
  <li><a href="/fixed">/fixed</a> — construction hoisted out via <code>$effect.root</code> (the fix)</li>
</ul>
