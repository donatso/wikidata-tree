
from pywikibot.data import api
import pywikibot
import json

site_wikidata = pywikibot.Site("wikidata", "wikidata")
repo_wikidata = site_wikidata.data_repository()

class wikidataVariables():
    spouse_P = "P26"
    child_P = "P40"
    father_P = "P22"
    mother_P = "P25"
    sibling_P = "P3373"
    img_P = "P18"
    gender_P = "P21"
    male_Q = "Q6581097"
    female_Q = "Q6581072"
    persons = {}
    lookup = {}


wiki_vars = wikidataVariables()

relatives_trans_wikidata = {wiki_vars.father_P: "Otac", wiki_vars.mother_P: "Majka",
                            wiki_vars.child_P: "Dijete", wiki_vars.spouse_P: "Supružnik",
                            wiki_vars.sibling_P: "Braća/Sestre"}


def get_from_wikidata(search_text):
    result_list = []

    name = search_text.capitalize()

    def getItems(site, itemtitle):
        params = {'action': 'wbsearchentities', 'format': 'json', 'language': 'en', 'type': 'item', 'search': itemtitle}
        request = api.Request(site=site, **params)
        return request.submit()

    wikidataEntries = getItems(site_wikidata, name)
    search = wikidataEntries['search']

    search_id = None
    print(len(search))


    for result in search:
        item = pywikibot.ItemPage(repo_wikidata, result["id"])
        item_dict = item.get()
        try:
            instance_of = item_dict["claims"]["P31"][0].getTarget().getID()
        except:
            continue
        if instance_of == "Q5":
            cont = item._content
            p_label = cont["labels"]["en"]["value"]
            wiki_vars.persons[cont["id"]] = cont
            result_list += [{"wiki_id": cont["id"], "label": lbl_wikidata(cont["id"])}]

    return result_list


def lbl_wikidata(osoba_id, lang="en", just_fns=False):
    try:
        return wiki_vars.persons[osoba_id]["labels"][lang]["value"]
    except:
        return wiki_vars.persons[osoba_id]["labels"][list(wiki_vars.persons[osoba_id]["labels"].keys())[0]][
            "value"]


def img_wikidata(osoba_id):
    citations = []
    c = wiki_vars.persons[osoba_id]["claims"]
    if wikidataVariables.img_P in c:
        citations = [c[wikidataVariables.img_P][0]["mainsnak"]["datavalue"]["value"]]
    else:
        pass
    return []


def wikidata_tree(persona_id):
    rels_ids = []

    def get_rels(p_id, side, depth):
        rels = []
        rel_types = [wiki_vars.father_P, wiki_vars.mother_P] if side == "ancestry" else [wiki_vars.child_P]
        c = wiki_vars.persons[p_id]["claims"]
        for rel_type in rel_types:
            if rel_type in c.keys():
                for rel_val in c[rel_type]:
                    rel_id = rel_val["mainsnak"]["datavalue"]["value"]["id"]
                    rel = get_info(rel_id)
                    if depth < 2:
                        rel[side] = get_rels(rel_id, side, depth + 1)
                    rels += [rel]
                    rels_ids.append(rel_id)
        return rels

    def get_info(p_id):
        if p_id not in wiki_vars.persons:
            p = pywikibot.ItemPage(repo_wikidata, p_id)
            p.get()
            wiki_vars.persons[p._content["id"]] = p._content
        c = wiki_vars.persons[p_id]["claims"]
        def get_gender():
            if wiki_vars.gender_P in c:
                gender = c[wiki_vars.gender_P][0]["mainsnak"]["datavalue"]["value"]["id"]
                gender = "f" if gender == wiki_vars.female_Q else "m"
            else:
                gender = "u"
            return gender

        def get_img():
            if wiki_vars.img_P in c:
                rl = c[wiki_vars.img_P][0]["mainsnak"]["datavalue"]["value"]
                img_url = get_img_url(rl)
                return img_url
            return ""

        return {"wiki_id": p_id, "label": lbl_wikidata(p_id), "gender": get_gender(), "citation": get_img()}

    tree = get_info(persona_id)
    tree["ancestry"] = get_rels(persona_id, "ancestry", depth=0)
    tree["progeny"] = get_rels(persona_id, "progeny", depth=0)

    return tree

with open("static/files/query.json", "r") as f:
    wiki_vars.lookup = json.load(f)

def lookup(search):
    suggs = []
    for item in wiki_vars.lookup:
        if search.lower() in item["humanLabel"].lower():
            suggs += [{"value": item["humanLabel"], "data": item["human"].split("/")[-1]}]
            if len(suggs) == 7:
                break
    return suggs


from bs4 import BeautifulSoup
import requests
def get_img_url(rl):
    url = "https://commons.wikimedia.org/wiki/File:" + rl
    response = requests.get(url)
    soup = BeautifulSoup(response.content, "html.parser")
    try:
        img_url = soup.find("img", attrs={"alt": "File:{}".format(rl)}).attrs["src"]
        print(img_url)
    except:
        img_url = ""
    return img_url