import pytest
from helpers import *  # pylint: disable=W0401,W0614

def test_add_headers_to_set():
    new_set = set()
    add_headers_to_set(new_set, '\\ph,testing', ',')
    assert new_set == {'\\ph'}


def test_remove_string_empty_key_safely():
    new_dictionary = {1: '1', '': '2', 2: '3'}
    remove_string_empty_key_safely(new_dictionary)
    cleaned_dictionary = new_dictionary
    remove_string_empty_key_safely(cleaned_dictionary)
    assert new_dictionary == {1: '1', 2: '3'}
    assert cleaned_dictionary == {1: '1', 2: '3'}


def test_replace_commas_inside_quotes_safely():
    text = replace_commas_inside_quotes_safely(
        '"just, a, comma" , "change my , for an *"', '*')
    assert text == '"just* a* comma" , "change my * for an *"'


@pytest.mark.parametrize(
        ('input_x', 'expected'),
        (
            ('\\lx,test,\\ph,,,,,\\ps', '\\lx,test,\\ph,,\\ps'),
            ('\\lx,test,,\\ph,,\\ps', '\\lx,test,\\ph,,\\ps'),
            ('\\lx,test,,,,,,,,,,\\ph,,\\ps', '\\lx,test,\\ph,,\\ps'),
            ('\\lx,test,,\\ph,,,\\ps', '\\lx,test,\\ph,,\\ps'),
            ('\\lx,test,,\\ph,tɛst,,\\ps', '\\lx,test,\\ph,tɛst,\\ps'),
            ('\\lx,test,,,\\ph,tɛst,,,\\ps', '\\lx,test,\\ph,tɛst,\\ps')
        )
)
def test_remove_extra_commas(input_x, expected):
    cleaned_entry = remove_extra_commas(input_x)
    assert cleaned_entry == expected


def test_undo_comma_replacement():
    cleaned_text = undo_comma_replacement('"brook&&& stream*&&& water"', '&&&')
    assert cleaned_text == '"brook, stream*, water"'


def test_turn_entry_into_dictionary():
    dictionary = turn_entry_into_dictionary(
        ['\\lx', 'Arroyo', '\\ge', '"brook&&& stream"', '\\dt', '24/Jan/2023'], '&&&')
    assert dictionary == {'\\ge': '"brook, stream"',
                          '\\lx': 'Arroyo', '\\dt': '24/Jan/2023'}


def test_replace_multiple_text_fragments():
    little_tale = '''
    Once upon a time a "Dino, Dinosaur, Rex" was tired and it says: "this life is awful, terrible and sad",
    '''
    commas_between_quotes_regex = '("[^",]+),([^"]+")'
    replaced_text = replace_multiple_text_fragments(
        little_tale, commas_between_quotes_regex, '*', ',')
    assert replaced_text == '''
    Once upon a time a "Dino* Dinosaur* Rex" was tired and it says: "this life is awful* terrible and sad",
    '''

def test_replace_multiple_text_fragments_to_remove_the_last_unwanted_comma():
    full_entries_with_extra_commas_regex = '\\\\([^,])+,[^,\n]+(,,+)'
    replaced_text = replace_multiple_text_fragments(
        '\\lx,oso,,,\\gl,bear,,,', full_entries_with_extra_commas_regex)
    assert replaced_text == '\\lx,oso,,\\gl,bear,,'


def test_replace_multiple_text_fragments_with_replacement_only():
    replaced_text = replace_multiple_text_fragments('hello world', 'o', '*')
    assert replaced_text == 'hell* w*rld'


def test_replace_multiple_text_fragments_with_fragment_to_replace_only():
    with pytest.raises(ValueError, match="fragment_to_replace cannot be set alone"):
        replace_multiple_text_fragments('hello world', 'o', fragment_to_replace='o')


def test_clean_entry():
    cleaned_entry = clean_entry(
        '\\lx,Arroyo,\\ph,,,\\ge,"brook, stream",\\re,brook ; stream,,\\dt,24/Jan/2023,,,,,', '???')
    assert cleaned_entry == [
        '\\lx', 'Arroyo',
        '\\ph', '',
        '\\ge', '"brook??? stream"',
        '\\re', 'brook ; stream',
        '\\dt', '24/Jan/2023', ''
    ]


def test_handle_senses():
    entry = ['\\lx', 'Arroyo', '\\ge', 'brook', '\\xv', '',
             '\\ge', 'stream', '\\xv', 'the stream flows']
    new_headers = handle_senses(entry, {'\\ge', '\\xv'}, '\\ge')
    assert entry == ['\\lx', 'Arroyo', '\\ge1', 'brook', '\\xv1-1',
                     '', '\\ge2', 'stream', '\\xv2-1', 'the stream flows']
    assert new_headers == {'\\xv2-1', '\\ge2', '\\xv1-1', '\\ge1'}
