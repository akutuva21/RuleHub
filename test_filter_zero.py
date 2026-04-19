import re

reactions = dict()
# Mock data from net2d2d parsing of prion_model_exact.net
reactions[1] = ((0,), (1,), 'k1')
reactions[2] = ((1,), (0,), 'k2')
reactions[3] = ((0,), (0,), 'k3')
reactions[4] = ((1, 2), (3,), 'k4')

out = []

for i in reactions:
    react,prod,rate = reactions[i]

    # Filter out 0 which represents empty in BNG .net files
    react = tuple([j for j in react if j != 0])
    prod = tuple([j for j in prod if j != 0])

    if react:
        d2drate = '%s*%s' % ('*'.join(['sp%i' % j for j in react]), rate)
    else:
        d2drate = rate

    out.append('%s -> %s CUSTOM "%s"' % (' + '.join(['sp%i' % j for j in react]), ' + '.join(['sp%i' % j for j in prod]), d2drate))

for line in out:
    print(line)
