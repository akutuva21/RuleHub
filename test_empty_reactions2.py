import re

reactions = dict()
# Test adding an empty reaction
reactions[1] = (tuple([]), tuple([1]), 'k1')
reactions[2] = (tuple([1]), tuple([]), 'k2')
reactions[3] = (tuple([]), tuple([]), 'k3')

out = []

for i in reactions:
    react,prod,rate = reactions[i]

    react_str = ' + '.join(['sp%i' % j for j in react]) if react else '0'
    prod_str = ' + '.join(['sp%i' % j for j in prod]) if prod else '0'
    d2drate = '*'.join(['sp%i' % j for j in react] + [rate])

    out.append('%s -> %s CUSTOM "%s"\n' % (react_str, prod_str, d2drate))

for line in out:
    print(line)
