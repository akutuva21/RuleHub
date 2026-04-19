import re

netfilename = 'Published/Lin2019/prion_model_exact.net'

reactions = dict()

with open(netfilename) as f:
    insection = None
    for line in f:
        line = line.strip()

        # Check for "begin" and "end" statements
        m = re.match(r'begin\s+([a-z]+)',line)
        if m and insection is None:
            insection = m.groups()[0]
            continue
        if re.match(r'end\s+%s' % insection, line):
            insection = None
            continue

        # Add this line to appropriate data structure
        parts = line.split()
        if insection == 'reactions':
            reactions[int(parts[0])] = (tuple([int(x) for x in parts[1].split(',')]), tuple([int(x) for x in parts[2].split(',')]), parts[3])

for i in list(reactions.keys())[:5]:
    print(f"Reaction {i}: {reactions[i]}")
