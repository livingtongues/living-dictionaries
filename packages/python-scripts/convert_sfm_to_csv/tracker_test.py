import pytest
from tracker import Tracker

tracker1 = Tracker({'\\lx', '\\xv'}, '\\lx')


@pytest.mark.parametrize(
    ('input_x', 'expected'),
    (
        ('\\lx', {'\\lx': 1, '\\xv': 0}),
        ('\\xv', {'\\lx': 1, '\\xv': 1}),
        ('\\xv', {'\\lx': 1, '\\xv': 2}),
        ('\\lx', {'\\lx': 2, '\\xv': 0}),
        ('\\xv', {'\\lx': 2, '\\xv': 1}),
    )
)
def test_handle_counters(input_x, expected):
    tracker1._Tracker__handle_counters(input_x)  # pylint: disable=W0212
    assert tracker1.element_counter == expected


tracker2 = Tracker({'\\lx', '\\xv'}, '\\lx')


@pytest.mark.parametrize(
    ('input_x', 'expected'),
    (
        ('\\lx', '\\lx1'),
        ('\\xv', '\\xv1-1'),
        ('\\xv', '\\xv1-2'),
        ('\\lx', '\\lx2'),
        ('\\xv', '\\xv2-1'),
        ('\\lx', '\\lx3'),
        ('\\lx', '\\lx4'),
        ('\\xv', '\\xv4-1'),
        ('\\xv', '\\xv4-2'),
        ('\\xv', '\\xv4-3'),
    )
)
def test_change_keys_display(input_x, expected):
    tracker2._Tracker__handle_counters(input_x)  # pylint: disable=W0212
    # pylint: disable=W0212
    assert tracker2._Tracker__change_keys_display(input_x) == expected


tracker3 = Tracker({'\\lx', '\\xv'}, '\\lx')


@pytest.mark.parametrize(
    ('input_x', 'expected'),
    (
        ('\\lx', {'\\lx1'}),
        ('\\xv', {'\\lx1', '\\xv1-1'}),
        ('\\xv', {'\\lx1', '\\xv1-1', '\\xv1-2'}),
        ('\\lx', {'\\lx1', '\\xv1-1', '\\xv1-2', '\\lx2'}),
        ('\\lx', {'\\lx1', '\\xv1-1', '\\xv1-2', '\\lx2', '\\lx3'}),
    )
)
def test_get_new_headers(input_x, expected):
    tracker3._Tracker__handle_counters(input_x)  # pylint: disable=W0212
    tracker3._Tracker__change_keys_display(input_x)  # pylint: disable=W0212
    new_headers = tracker3.get_new_headers()
    assert new_headers == expected


def test_tracker_initialization():
    my_tracker = Tracker({'test'}, 'test')
    assert str(type(my_tracker)) == "<class 'tracker.Tracker'>"


def test_element_counter():
    my_tracker = Tracker({'\\lx', '\\xv'}, '\\lx')
    my_tracker.number_duplicates_in_list(['\\lx', '\\lx', '\\xv', '\\lx'])
    assert my_tracker.element_counter == {'\\lx': 3, '\\xv': 0}


def test_number_duplicates_in_list():
    my_list = ['\\lx', 'Arroyo', '\\ge', 'brook', '\\xv', '', '\\ge', 'stream', '\\xv',
               'the stream flows', '\\ge', 'river', '\\ge', 'water', '\\xv', 'water also flows']
    my_tracker = Tracker({'\\ge', '\\xv'}, '\\ge')
    my_tracker.number_duplicates_in_list(my_list)
    assert my_list == [
        '\\lx', 'Arroyo',
        '\\ge1', 'brook',
        '\\xv1-1', '',
        '\\ge2', 'stream',
        '\\xv2-1', 'the stream flows',
        '\\ge3', 'river',
        '\\ge4', 'water',
        '\\xv4-1', 'water also flows'
    ]


def test_number_duplicates_in_list_with_multiple_examples():
    my_list = [
        '\\lx', 'Arroyo',
        '\\ge', 'stream',
        '\\xv', 'the stream',
        '\\xv', 'the stream flows',
        '\\ge', 'water',
        '\\xv', 'the water is blue',
        '\\xv', 'the water is green',
        '\\xv', 'the water is pink',
        '\\ge', 'brook',
        '\\xv', 'the brook is flowing'
    ]
    my_tracker = Tracker({'\\ge', '\\xv'}, '\\ge')
    my_tracker.number_duplicates_in_list(my_list)
    assert my_list == [
        '\\lx', 'Arroyo',
        '\\ge1', 'stream',
        '\\xv1-1', 'the stream',
        '\\xv1-2', 'the stream flows',
        '\\ge2', 'water',
        '\\xv2-1', 'the water is blue',
        '\\xv2-2', 'the water is green',
        '\\xv2-3', 'the water is pink',
        '\\ge3', 'brook',
        '\\xv3-1', 'the brook is flowing'
    ]


def test_number_duplicates_in_list_considering_some_headers_only():
    my_list = [
        '\\lx', 'Aprender',
        '\\n', 'new',
        '\\ge', 'nearby',
        '\\re', 'nearby',
        '\\gn', '',
        '\\dt', '11/Jan/2005',
        '\\ps', 'v',
        '\\n', '0281a',
        '\\ge', '"learn999 teach999 tame"',
        '\\re', 'learn ; teach ; tame',
        '\\xv', 'learn is fun',
        '\\xv', 'learning is good',
        '\\gn', 'apprendre',
        '\\dt', '28/Jan/2005'
    ]
    my_tracker = Tracker({'\\ge', '\\re', '\\xv'}, '\\ge')
    my_tracker.number_duplicates_in_list(my_list)
    assert my_list == [
        '\\lx', 'Aprender',
        '\\n', 'new',
        '\\ge1', 'nearby',
        '\\re1-1', 'nearby',
        '\\gn', '',
        '\\dt', '11/Jan/2005',
        '\\ps', 'v',
        '\\n', '0281a',
        '\\ge2', '"learn999 teach999 tame"',
        '\\re2-1', 'learn ; teach ; tame',
        '\\xv2-1', 'learn is fun',
        '\\xv2-2', 'learning is good',
        '\\gn', 'apprendre',
        '\\dt', '28/Jan/2005'
    ]
