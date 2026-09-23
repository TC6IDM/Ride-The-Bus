"Handles independent simulation events and details."

from copy import deepcopy

_JSON_SCALARS = (str, int, float, bool, type(None))


def copy_event(value):
    """
    A deep copy for the JSON-shaped data an event is made of.

    Every event ends up inside the book's JSON (see Book.to_json), so an event
    is a tree of dicts, lists and scalars. copy.deepcopy's memo table,
    _keep_alive list and reductor dispatch are all cost with nothing to show
    for them on data like that: in a profile of one Ride The Bus mode, 3.3M
    deepcopy calls were 17% of the whole simulation pass.

    Anything that is not exactly a dict, list or scalar - including a subclass
    of one - still goes through deepcopy, so a game that puts something else
    in an event behaves exactly as before.
    """
    kind = type(value)
    if kind is dict:
        # Fast path: an event whose values are all scalars - which is almost
        # every event - is copied by dict() in C, after one pass over the
        # values to prove it. Only a nested event pays for the recursion.
        for item in value.values():
            if type(item) not in _JSON_SCALARS:
                return {key: copy_event(item) for key, item in value.items()}
        return dict(value)
    if kind is list:
        return [copy_event(item) for item in value]
    if kind in _JSON_SCALARS:
        return value
    return deepcopy(value)


class Book:
    "Stores simulation information."

    def __init__(self, book_id: int, criteria: str):
        "Initialize simulation book"
        self.id = book_id
        self.payout_multiplier = 0.0
        self.events = []
        self.criteria = criteria
        self.basegame_wins = 0.0
        self.freegame_wins = 0.0

    def add_event(self, event: dict):
        "Append event to book."
        self.events.append(copy_event(event))

    def append_book_items(self, event_id: int, appended_info: dict):
        "Modify an existing book event at position 'event_id'"
        for k, v in appended_info.items():
            self.events[event_id][k] = v

    def to_json(self):
        "Return JSON-ready object."
        json_book = {
            "id": self.id,
            "payoutMultiplier": int(round(self.payout_multiplier * 100, 0)),
            "events": self.events,
            "criteria": self.criteria,
            "baseGameWins": self.basegame_wins,
            "freeGameWins": self.freegame_wins,
        }
        return json_book
