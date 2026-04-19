import re

reactions = dict()
# Test adding an empty reaction
reactions[1] = (tuple([]), tuple([1]), 'k1')
reactions[2] = (tuple([1]), tuple([]), 'k2')
reactions[3] = (tuple([]), tuple([]), 'k3')

out = []

for i in reactions:
    react,prod,rate = reactions[i]

    # Using the convention seen in the ModelHistoneZheng.def
    # Empty reactants/products are just left empty, and for rate we multiply by the empty string or what?
    # In ModelHistoneZheng.def: `             -> K27me0K36me0 CUSTOM "inflow"`
    react_str = ' + '.join(['sp%i' % j for j in react]) if len(react) > 0 else ''
    prod_str = ' + '.join(['sp%i' % j for j in prod]) if len(prod) > 0 else ''

    if len(react) > 0:
        d2drate = '%s*%s' % ('*'.join(['sp%i' % j for j in react]), rate)
    else:
        d2drate = rate

    out.append('%s -> %s CUSTOM "%s"' % (react_str, prod_str, d2drate))

for line in out:
    print(line)
