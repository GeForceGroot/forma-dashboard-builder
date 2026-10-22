"""Integration checks against a running local LAMP stack. Restores the original layout."""
import copy
import http.cookiejar
import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080') + '/api/dashboard.php'
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def request(method='GET', data=None, token=None, raw=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['X-CSRF-Token'] = token
    body = raw if raw is not None else json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE, data=body, headers=headers, method=method)
    try:
        with client.open(req) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)

status, result = request()
assert status == 200, result
original = result['dashboard']
token = result['csrfToken']
payload = {key: original[key] for key in ('name', 'layout', 'version')}
assert request('PUT', payload)[0] == 403
assert request('POST', payload, token)[0] == 405
assert request('PUT', token=token, raw=b'{invalid')[0] == 400
invalid = copy.deepcopy(payload)
invalid['layout']['elements'][0]['x'] = -1
assert request('PUT', invalid, token)[0] == 422
invalid = copy.deepcopy(payload)
invalid['layout']['elements'][0]['parentId'] = invalid['layout']['elements'][0]['id']
assert request('PUT', invalid, token)[0] == 422
invalid = copy.deepcopy(payload)
chart = next(e for e in invalid['layout']['elements'] if e['type'] == 'bar')
chart['content']['values'] = [1]
assert request('PUT', invalid, token)[0] == 422
invalid = copy.deepcopy(payload)
image = next(e for e in invalid['layout']['elements'] if e['type'] == 'image')
image['content']['src'] = 'javascript:alert(1)'
assert request('PUT', invalid, token)[0] == 422
changed = copy.deepcopy(payload)
changed['name'] = 'Persistence integration check'
changed['layout']['elements'][0]['content']['runs'][0]['text'] = 'Saved and reloaded ✓'
status, saved = request('PUT', changed, token)
assert status == 200, saved
try:
    status, fetched = request()
    assert status == 200
    assert fetched['dashboard']['layout'] == changed['layout']
    assert fetched['dashboard']['name'] == changed['name']
    assert fetched['dashboard']['version'] == original['version'] + 1
    assert request('PUT', payload, token)[0] == 409
finally:
    payload['version'] = saved['dashboard']['version']
    status, restored = request('PUT', payload, token)
    assert status == 200, restored
print('PASS: load, save/reload, UTF-8 content, CSRF, methods, invalid JSON, bounds, parent cycles, chart validation, image validation, stale version conflict, and original layout restoration')
