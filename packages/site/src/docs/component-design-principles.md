# Component Design Principles

- Single Responsibility Principle - as much as possible, components should be responsible for one thing.
- Components don't import global stores, they only receive props and context. This means that all actions must be emitted as custom events. In the case of database actions let the parent page component consume the event and update the database. The component should built agnostic and just work, regardless of where in the web app it is placed.