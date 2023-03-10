from lexical_db_to_csv import (
    prepare_to_csv_export,
    clean_headers,
    create_entry_dictionaries,
)


def test_prepare_to_csv_export():
    my_tuple = prepare_to_csv_export('./test_sheet.csv')
    assert my_tuple == (
        {
            '\\lx', '\\dt',
            '\\extra_header', '\\ph', 'ph',
            '\\ps', '\n'
        },
        [
            '\\lx,test,\\ph,,\\ps,n,\\dt,17/Sep/2022,,',
            '\\lx,test2,\\ph,tɛst tuː,\\ps,n,\\dt,06/Feb/2023,,',
            '\\lx,test3,ph,,\\ps,,\\extra_header,,\\dt,07/Feb/2023'
        ]
    )


def test_clean_headers():
    cleaned_headers = clean_headers({
        '\\ps', '\\ph', '\n',
    },)
    assert cleaned_headers == {'\\ps', '\\ph'} or {'\\ph', '\\ps'}


def test_create_entry_dictionaries():
    new_tuple = create_entry_dictionaries([
        '\\lx,Arroyo,\\ph,,,\\ge,"brook, stream",\\re,brook ; stream,,\\dt,24/Jan/2023,,',
        '\\lx,Manzana,\\ph,,,\\ge,apple,\\re,,\\dt,09/Feb/2023'
    ], '&&&')
    assert new_tuple == (set(), [
        {'\\lx': 'Arroyo', '\\ph': '', '\\ge': '"brook, stream"',
            '\\re': 'brook ; stream', '\\dt': '24/Jan/2023'},
        {'\\lx': 'Manzana', '\\ph': '', '\\ge': 'apple',
         '\\re': '', '\\dt': '09/Feb/2023'}
    ])
