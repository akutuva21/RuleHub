import numpy as np
from numpy import sin, sqrt

def schw(x, y):
    return 837.9658 - x * sin(sqrt(np.abs(x))) - y * sin(sqrt(np.abs(y)))
