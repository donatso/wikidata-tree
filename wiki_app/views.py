import random
from django.shortcuts import render
from django.http import HttpResponse
from wiki_app.scripts import wikidata_persons
import json

def tree_view(request):
    if request.is_ajax():
        if request.method == 'GET':
            search = request.GET.get('search', '')
            person = request.GET.get('person', '')
            lookup = request.GET.get('query', '')

            if person != "":
                data = {"tree": wikidata_persons.wikidata_tree(person)}
                data = json.dumps(data)
                mimetype = 'application/json'
                return HttpResponse(data, mimetype)

            elif search != "":
                data = {"search": wikidata_persons.get_from_wikidata(search)}
                data = json.dumps(data)
                mimetype = 'application/json'
                return HttpResponse(data, mimetype)

            elif lookup != "":
                data = {"suggestions": wikidata_persons.lookup(lookup)}
                data = json.dumps(data)
                mimetype = 'application/json'
                return HttpResponse(data, mimetype)

    return render(request, "index.html")