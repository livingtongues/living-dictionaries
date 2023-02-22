import re
from typing import List, Dict, Pattern, Optional, Set, Tuple, Union
from tracker import Tracker

# FIRST PART


def add_headers_to_set(headers: set, text: str, separator: str) -> None:
    headers.add(text.split(separator)[0])

# SECOND PART


def remove_string_empty_key_safely(entry: Dict[str, str]) -> Dict[str, str]:
    return entry.pop('', None)


def replace_commas_inside_quotes_safely(text: str, replacement_code: str) -> str:
    commas_between_quotes_regex = '("[^",]+),([^"]+")'
    text = replace_multiple_text_fragments(
        text, commas_between_quotes_regex, replacement_code, ',')
    return text


def remove_extra_commas(entry: str) -> str:
    full_entries_with_extra_commas_regex = '\\\\([^,])+,[^,\n]+(,,+)'
    match_more_than_two_commas_regex = '(,{2}),+'
    cleaned_entry = re.sub(match_more_than_two_commas_regex, ',,', entry)
    cleaned_entry = replace_multiple_text_fragments(
        cleaned_entry, full_entries_with_extra_commas_regex)
    return cleaned_entry


def undo_comma_replacement(text: str, temporal_character_replacement: str) -> str:
    match_temporal_character_inisde_quotes_regex = r'("[^",]+)' + \
        temporal_character_replacement + r'([^"]+")'
    text = replace_multiple_text_fragments(
        text, match_temporal_character_inisde_quotes_regex, ',', temporal_character_replacement)
    return text


def turn_entry_into_dictionary(elements: List[str], temporal_replacement: str) -> Dict[str, str]:
    new_dictionary = {}
    for i in range(0, len(elements), 2):
        if i < len(elements)-1:
            elements[i +
                     1] = undo_comma_replacement(elements[i+1], temporal_replacement)
            new_dictionary[elements[i]] = elements[i+1]
        remove_string_empty_key_safely(new_dictionary)
    return new_dictionary


def clean_entry(
        entry: str,
        temporal_comma_replacement: str,
        headers_to_track: Optional[Dict[str, Set[str]]] = None
) -> Union[List[str], Tuple[Set[str], List[str]]]:
    entry = replace_commas_inside_quotes_safely(
        entry, temporal_comma_replacement)
    entry = remove_extra_commas(entry)
    elements = entry.split(',')
    if headers_to_track:
        main_header = list(headers_to_track.keys())[0]
        new_headers = handle_senses(
            elements, headers_to_track[main_header], main_header)
        return (new_headers, elements)
    return elements


def handle_senses(entry: List[str], headers_to_track: Set[str], main_header: str) -> Set[str]:
    tracker = Tracker(headers_to_track, main_header)
    tracker.number_duplicates_in_list(entry)
    return tracker.get_new_headers()


def replace_multiple_text_fragments(
        text: str,
        regex: Pattern,
        replacement: Optional[str] = None,
        fragment_to_replace: Optional[str] = None
) -> str:
    if re.search(regex, text):
        fragments = re.finditer(regex, text)
        for fragment in fragments:
            if fragment_to_replace and replacement:
                temporal_replacement = fragment[0].replace(
                    fragment_to_replace, replacement)
            elif fragment_to_replace:
                temporal_replacement = fragment[0].replace(
                    fragment_to_replace, fragment[0][:-1])
            elif replacement:
                temporal_replacement = fragment[0].replace(
                    fragment[0], replacement)
            else:
                temporal_replacement = fragment[0].replace(
                    fragment[0], fragment[0][:-1])
            text = text.replace(fragment[0], temporal_replacement)
    return text
