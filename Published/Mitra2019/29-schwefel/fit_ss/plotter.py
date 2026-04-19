import matplotlib.pyplot as plt
from numpy import sin,sqrt
import numpy as np
import copy

def movie():

    data = dict()
    with open('sorted_params_final.txt') as f:
        f.readline()
        for line in f:
            parts = line.strip().split()
            data[parts[0]] = [float(x) for x in parts[1:]]
    
    tab10 = plt.cm.get_cmap('tab10')

    thisdata_init = [data[f'init{i}'] for i in range(5)]
    scores = [d[0] for d in thisdata_init]
    xs = [d[1] for d in thisdata_init]
    ys = [d[2] for d in thisdata_init]
    cs = [tab10(i) for i in range(5)]

    plot_once(0)
    plot_once(1,dots=(xs,ys,cs))
    i=2
    
    pairs = [(p, h) for p in range(5) for h in range(5) if p != h]
    for it in range(1,20):
        oldxs = list(xs)
        oldys = list(ys)

        thisdata_it = [data[f'iter{it}p{p}h{h}'] for p, h in pairs]
        propx = [d[1] for d in thisdata_it]
        propy = [d[2] for d in thisdata_it]
        propcp = [tab10(p) for p, h in pairs]
        propch = [tab10(h) for p, h in pairs]

        for (p, h), d in zip(pairs, thisdata_it):
            if d[0] < scores[p]:
                xs[p] = d[1]
                ys[p] = d[2]
                scores[p] = d[0]

        plot_once(i,dots=(oldxs,oldys,cs), triangles=(propx,propy,propcp),dtriangles=(propx,propy,propch))
        plot_once(i+1,dots=(xs,ys,cs))
        i+=2
    

def plot_once(i,dots=None,triangles=None,dtriangles=None):
    plt.figure()
    
    xs, ys = np.meshgrid(np.linspace(0,500,5000), np.linspace(0,500,500))
    zs = schw(xs, ys)
    plt.contourf(xs, ys, zs,levels=np.linspace(0,2000,100),cmap='Greys_r')
    if dots:
        plt.scatter(dots[0],dots[1],c=dots[2],marker='o')
    if dtriangles:
        plt.scatter(dtriangles[0],dtriangles[1],c=dtriangles[2],marker='v')
    if triangles:
        plt.scatter(triangles[0],triangles[1],c=triangles[2],marker='^')
    plt.axis('square')
    plt.axis([0,500,0,500])
    # plt.show()
    plt.savefig('ss%i' % i)
    

def schw(x,y):
    return  837.9658 - x * sin(sqrt(np.abs(x))) - y * sin(sqrt(np.abs(y)))
