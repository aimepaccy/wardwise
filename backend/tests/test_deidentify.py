import json

from app import deidentify, generate, providers
from app.deidentify import Identifier, replace
from tests.test_api import WEBM, finished_job, post


def name(text: str) -> Identifier:
    return Identifier(text=text, kind='name')


def test_names_are_replaced_with_possessives_and_longest_first():
    text = "Keza Uwase is six. Keza's mother says Keza wheezes at night."
    cleaned, removed = replace(text, [name('Keza'), name('Keza Uwase')])
    assert cleaned == "[name] is six. [name]'s mother says [name] wheezes at night."
    assert removed == {'name': 1}  # one person, listed twice


def test_a_full_name_also_removes_its_parts_said_alone():
    text = 'This is Keza Ishimwe, six. Later Keza laughed. Her mother, Mrs Mukamana, said Mukamana is the surname.'
    cleaned, removed = replace(text, [name('Keza Ishimwe'), name('Mrs Mukamana')])
    assert cleaned == 'This is [name], six. Later [name] laughed. Her mother, [name], said [name] is the surname.'
    assert 'Mrs' not in cleaned
    assert removed == {'name': 2}


def test_eponyms_stay_even_if_the_model_lists_them():
    text = 'Murphy was the registrar. Check Murphy\'s sign and the Glasgow Coma Scale.'
    cleaned, _ = replace(text, [name('Murphy'), name('Glasgow')])
    assert cleaned == "[name] was the registrar. Check Murphy's sign and the Glasgow Coma Scale."


def test_only_what_the_text_says_is_replaced():
    text = 'The patient is a 6-year-old girl. Give salbutamol 5 mg.'
    items = [name('Amina'), name('patient'), name('The patient is a 6-year-old girl and more words'), name('[name]')]
    cleaned, removed = replace(text, items)
    assert cleaned == text
    assert not removed


def test_a_name_inside_another_word_stays():
    cleaned, _ = replace('Ali is here. Give alimemazine? No.', [name('Ali')])
    assert cleaned == '[name] is here. Give alimemazine? No.'


def test_long_numbers_go_even_without_the_model_but_doses_stay():
    text = 'Call mum on 0788123456. Give 2.5 mg salbutamol, 15 litres of oxygen, 1000000 units.'
    cleaned, removed = replace(text, [])
    assert cleaned == 'Call mum on [number]. Give 2.5 mg salbutamol, 15 litres of oxygen, 1000000 units.'
    assert removed == {'number': 1}


def test_other_kinds_get_their_own_placeholder():
    text = 'She lives in Kimironko, born 3 March 2019, bed 4.'
    items = [
        Identifier(text='Kimironko', kind='place'),
        Identifier(text='3 March 2019', kind='date'),
        Identifier(text='bed 4', kind='number'),
    ]
    cleaned, removed = replace(text, items)
    assert cleaned == 'She lives in [place], born [date], [number].'
    assert deidentify.summary(removed) == ['1 number', '1 place', '1 date of birth']


def test_summary_counts_in_words():
    assert deidentify.summary({'name': 2, 'number': 1}) == ['2 names', '1 number']
    assert deidentify.summary({}) == []


def test_long_text_is_checked_in_pieces():
    text = ' '.join(['Wheeze is common in children.'] * 700)
    pieces = deidentify.chunks(text)
    assert len(pieces) > 1
    assert all(len(piece) <= deidentify.CHUNK_CHARS for piece in pieces)
    assert ' '.join(pieces) == text


def test_the_session_comes_back_without_names(fake_writer, monkeypatch):
    from app import providers as real

    monkeypatch.setattr(real, 'transcribe', lambda audio, kind: 'Keza has a silent chest. Call 0788123456.')
    fake_writer['answers'].append(json.dumps({'items': [{'text': 'Keza', 'kind': 'name'}]}))
    state = finished_job(post(audio=('round.webm', WEBM)))
    assert state['materials']['transcript'] == '[name] has a silent chest. Call [number].'
    assert state['materials']['removed'] == ['1 name', '1 number']
    check = fake_writer['calls'][0]
    assert check['form'] == 'Identifiers'
    assert '<text>' in check['material']


def test_a_failed_check_warns_but_the_session_still_arrives(fake_writer):
    fake_writer['answers'].append(providers.ProviderError('busy'))
    state = finished_job(post(audio=('round.webm', WEBM)))
    assert state['status'] == 'done'
    assert state['materials']['transcript']
    assert any('could not check this session for names' in warning for warning in state['materials']['warnings'])


def test_the_writer_is_told_not_to_name_anyone():
    assert 'Never name a person' in generate.pack_instructions(generate.caps_for(300))


def test_a_bare_short_number_is_never_wiped():
    text = 'Bed 4, salbutamol 4 puffs, age 4.'
    cleaned, _ = replace(text, [Identifier(text='4', kind='number'), Identifier(text='Bed 4', kind='number')])
    assert cleaned == '[number], salbutamol 4 puffs, age 4.'


def test_a_possessive_name_goes_unless_it_is_a_real_eponym():
    text = "Keza's test was negative. Uwase's score was 8. Check Graves' disease."
    cleaned, _ = replace(text, [name('Keza'), name('Uwase'), name('Graves')])
    assert cleaned == "[name]'s test was negative. [name]'s score was 8. Check Graves' disease."


def test_roles_and_relatives_are_not_names():
    text = 'Ward round today. Auntie Grace brought Baby Girl Uwase. Registrar Ndayisaba saw her.'
    items = [name('Auntie Grace'), name('Baby Girl Uwase'), name('Registrar Ndayisaba')]
    cleaned, _ = replace(text, items)
    assert cleaned == 'Ward round today. [name] brought [name]. [name] saw her.'


def test_spaced_rwandan_phone_numbers_go():
    cleaned, removed = replace('Call 0788 123 456 or +250 788 123 456. Give 250 mg.', [])
    assert cleaned == 'Call [number] or [number]. Give 250 mg.'
    assert removed == {'number': 2}


def test_unpunctuated_text_is_still_cut_into_pieces():
    text = ' '.join(['wheeze'] * 4000)
    assert all(len(piece) <= deidentify.CHUNK_CHARS for piece in deidentify.chunks(text))


def test_a_name_in_the_notes_also_leaves_the_transcript(fake_writer):
    fake_writer['answers'].extend([json.dumps({'items': []}), json.dumps({'items': [{'text': 'Keza', 'kind': 'name'}]})])
    transcript, notes, removed, checked = deidentify.clean('Keza is wheezy.', 'Keza: silent chest')
    assert (transcript, notes, checked) == ('[name] is wheezy.', '[name]: silent chest', True)
    assert removed == {'name': 1}


def test_a_broken_answer_is_tried_again_then_counted_as_unchecked(fake_writer):
    fake_writer['answers'].extend(['{"items": [{"text": 5}]}', '{"oops": 1}'])
    transcript, _, _, checked = deidentify.clean('Keza is wheezy. Call 0788123456.', None)
    assert transcript == 'Keza is wheezy. Call [number].'
    assert checked is False
