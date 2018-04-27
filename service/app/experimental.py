from pyramid.response import Response
from pyramid.view import view_config
from pyramid.httpexceptions import (
    HTTPNotFound,
    HTTPInternalServerError,
    HTTPForbidden,
    HTTPUnauthorized
)

import logging
log = logging.getLogger(__name__)

import sys
import time
from lxml import etree, html
import networkx as nx
from networkx.readwrite import json_graph
import StringIO
import os
import os.path
import datetime

from config import Config

from Helpers import *
from Network import Network
from Entity import Entity

from config import Config

@view_config(route_name='clique_status', request_method='GET', renderer='ujson')
def clique_status(request):
    db = mdb(request)
    site = request.matchdict['code']
    graph_type = 'byEntity'
    claims, site_data = verify_access(request, site=site)

    doc = db.network.find_one({ 'site': site, 'graph_type': graph_type })
    # if there a graph in Mongo already?
    if doc is not None:
        graph_data = doc['graph_data']
        doc = db.network_progress.remove({ 'site': site })

#       # Convert from the directed graph in Mongo, to undirected, for find_cliques, as find_cliques is
        # incompatible with directed graphs
        clique_data = json_graph.node_link_graph(graph_data, directed=False, multigraph=False)
        cliques = nx.find_cliques(clique_data)

        # Find cliques with 3 or more entities, discard the rest
        cliques3 = [clq for clq in cliques if len(clq) >=3]
        return { 'total': None, 'processed': None, 'cliques': cliques3 }
        #return { 'total': doc['total'], 'processed': doc['processed'] }
    else:
        # no graph in Mongo, lets generate one
        doc = db.network_progress.find_one({ 'site': site })
        return { 'total': doc['total'], 'processed': doc['processed'] }

