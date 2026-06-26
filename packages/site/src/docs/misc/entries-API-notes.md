# Entries API

These are just initial scratch notes and no API has been created yet.

- On the **Export** page Dictionary managers will see an **API** section with a link to
documentation (this page once it's ready). This API section will have:
  - A button to create an API key for the dictionary. This will be shown only once and shared by all managers of the dictionary. If they lose it, they can roll the key and get a new one. We save the hash of it to verify it's accurate upon use.
  - If an API key has been created, we then show a usage meter tracking exactly how many entry reads they've incurred. An API request with a limit of 10 entries will add 10 reads to the meter. 

- Type interfaces are published to NPM: [`@living-dictionaries/types`](https://www.npmjs.com/package/@living-dictionaries/types)

- Fields which are only useful internally will not be shipped out

- Explain how the API works and then provide users with the following Story that allows them to paste in their API key and set up other parameters that are available, like limit. Presently we are using JSONPlaceholder as a demo and a simple user number instead of a real API key:

```
apiKey: 1, 
limit: '0-100;10'

URL: https://livingdictionaries.app/api?apiKey={apiKey}&limit={limit}
```

## Questions

- What are your thoughts as an end user about the above outline?
- Since only dictionary managers can create an API key, what is the point of only conditionally making the API available? The managers are the only people we have contact with (in many cases) and so perhaps a message explaining they first need community permission is more helpful?
- Is there a reason to place a max limit on the API? We should allow dictionary managers to download the entire dictionary, but probably should only that once an hour, to avoid them accidentally downloading 10,000 entries 30 times in a minute during testing if they are careless. Entry reads are cheap but still... The API Preview tool above would also be capped because it fires off requests rapid fire upon every change of a parameter.
