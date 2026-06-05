from typing import Optional, Dict, Set, IO
from lexical_db_to_csv import (
    prepare_to_csv_export,
    clean_headers,
    create_entry_dictionaries,
    export_to_csv
)


STRING_FOR_TEMPORAL_REPLACEMENT = '&&&'


def create_csv(
        file_path: str,
        csv_name: str,
        headers_to_track: Optional[Dict[str, Set[str]]] = None
) -> IO:
    gross_dictionary_data = prepare_to_csv_export(file_path)
    all_headers = clean_headers(gross_dictionary_data[0])
    entries_with_new_headers = create_entry_dictionaries(
        gross_dictionary_data[1], STRING_FOR_TEMPORAL_REPLACEMENT, headers_to_track)
    entries = entries_with_new_headers[1]
    if headers_to_track:
        all_headers = all_headers.union(entries_with_new_headers[0])
    headers = sorted(list(all_headers))
    export_to_csv(headers, entries, csv_name)


if __name__ == "__main__":
    create_csv('./test_sheet.csv', 'result.csv',
               {'\\ge': {'\\ge', '\\re'}})
