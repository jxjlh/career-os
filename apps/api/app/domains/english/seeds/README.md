# English word-book seeds

These JSON files are generated from the public `DictionaryData` repository.
The importer uses `book.csv`, `word.csv`, `word_translation.csv`, and
`relation_book_word.csv` so each book contains all of its related entries
instead of a shared frequency-truncated subset.

Source license: Apache-2.0. Rebuild with:

```bash
python apps/api/scripts/build_complete_word_books.py /path/to/DictionaryData
```
