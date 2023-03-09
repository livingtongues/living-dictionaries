from typing import List, Set


class Tracker:
    def __init__(self, headers_to_track: Set[str], main_header: str):
        self.main_header = main_header
        self.element_counter = {key: 0 for key in headers_to_track}
        self.headers_to_track = headers_to_track
        self.__new_headers = set()

    def __change_keys_display(self, element: str) -> str:
        header_counter = str(self.element_counter[self.main_header])
        key_counter = str(self.element_counter[element])
        element += header_counter + \
            ('-' + key_counter if self.element_counter[element]
             > 0 and self.main_header != element else '')
        self.__new_headers.add(element)
        return element

    def __handle_counters(self, element: str) -> None:
        if self.main_header == element:
            for key in self.element_counter:
                if key == self.main_header:
                    self.element_counter[self.main_header] += 1
                else:
                    self.element_counter[key] = 0
        else:
            self.element_counter[element] += 1

    def number_duplicates_in_list(self, pair_entry: List[str]) -> None:
        for index, element in enumerate(pair_entry):
            if element in self.headers_to_track:
                self.__handle_counters(element)
                pair_entry[index] = self.__change_keys_display(element)

    def get_new_headers(self):
        return self.__new_headers
