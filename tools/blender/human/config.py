"""Character definition for Human_Adam: the parameters that make this particular person.

Everything the generator builds is derived from here, so a new character is a new config, not new code.
"""
import mh

NAME = "Human_Adam"

# 34-year-old man, 1.80 m, lean-athletic. Mixed ancestry, mostly southern European (Fitzpatrick III).
MACRO = mh.Macro(
    gender=1.0,
    age=mh.Macro.age_from_years(34),
    muscle=0.58,
    weight=0.48,
    height=0.53,
    proportions=0.62,
    caucasian=0.78,
    asian=0.08,
    african=0.14,
)

# Face individuality on top of the averaged macro shape. Real faces are never the population mean:
# a stronger jaw and brow, a slight nasal hump, fuller lower lip, and some left/right asymmetry.
DETAILS = {
    "chin/chin-prominent-incr": 0.25,
    "chin/chin-width-incr": 0.20,
    "chin/chin-bones-incr": 0.25,
    "head/head-square": 0.25,
    "forehead/forehead-nubian-incr": 0.10,
    "nose/nose-hump-incr": 0.35,
    "nose/nose-point-width-incr": 0.15,
    "nose/nose-scale-vert-incr": 0.10,
    "nose/nose-nostrils-width-incr": 0.10,
    "mouth/mouth-lowerlip-volume-incr": 0.20,
    "mouth/mouth-upperlip-volume-incr": 0.05,
    "mouth/mouth-cupidsbow-incr": 0.20,
    "cheek/l-cheek-bones-incr": 0.25,
    "cheek/r-cheek-bones-incr": 0.25,
    "cheek/l-cheek-volume-decr": 0.25,
    "cheek/r-cheek-volume-decr": 0.25,
    "eyebrows/eyebrows-trans-down": 0.15,
    "eyes/l-eye-bag-incr": 0.15,
    "eyes/r-eye-bag-incr": 0.18,
    "neck/neck-scale-horiz-incr": 0.15,
    # asymmetry (small: real asymmetry is a few millimetres)
    "asym/asym-eye-1-l": 0.25,
    "asym/asym-jaw-1-r": 0.20,
    "asym/asym-mouth-1-l": 0.20,
    "asym/asym-brown-1-r": 0.25,
    "asym/asym-ear-1-l": 0.30,
    "asym/asym-cheek-1-r": 0.15,
}

# Skin appearance (chromophore model, see textures.py)
SKIN = {
    "melanin": 0.42,            # epidermal melanin volume fraction scale (0.0 very fair .. 1.0 very dark)
    "melanin_type": 0.72,       # eumelanin share (rest pheomelanin): higher = browner, lower = more olive/red
    "hemoglobin": 0.55,         # baseline dermal blood
    "oxygenation": 0.75,
    "stubble": 0.95,            # 2-3 day shave
    "freckles": 0.12,
    "moles": 6,                 # number of visible nevi on face/neck
    "age_wrinkles": 0.45,
    "hair_color": (0.16, 0.105, 0.065),     # must match HAIR["color"]: painted scalp hair cap
    "seed": 7,
}

EYES = {
    "iris": (0.105, 0.052, 0.020),   # mid hazel-brown (linear)
    "iris_outer": (0.028, 0.018, 0.010),
    "iris_inner": (0.30, 0.16, 0.045),
    "sclera_redness": 0.25,
}

HAIR = {
    "color": (0.16, 0.105, 0.065),   # dark brown, linear albedo
    "melanin": 0.82,
    "melanin_redness": 0.35,
    "top_length": 0.055,             # m, combed back/side
    "side_length": 0.014,            # short tapered sides
    "back_length": 0.018,
    "density": 1.0,
}

HEIGHT_TARGET_M = 1.80

# Clothing (CC0 MakeHuman proxies, cleaned: see outfit.py). False exports the nude base body instead.
OUTFIT = True
