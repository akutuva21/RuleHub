import timeit

def benchmark():
    setup_code = """
class MockTab10:
    def __call__(self, i):
        return (0.1, 0.2, 0.3, 1.0)
tab10 = MockTab10()
data = {f'init{i}': [1.0, 2.0, 3.0] for i in range(5)}
for i in range(1, 20):
    for p in range(5):
        for h in range(5):
            data[f'iter{i}p{p}h{h}'] = [1.0, 2.0, 3.0]
xs, ys, scores = [1.0]*5, [2.0]*5, [1.0]*5
"""

    old_code = """
xs = []
ys = []
cs = []
scores = []
for i in range(5):
    thisdata = data['init%i'%i]
    scores.append(thisdata[0])
    xs.append(thisdata[1])
    ys.append(thisdata[2])
    cs.append(tab10(i))
"""

    new_code_listcomp = """
init_data = [data[f'init{i}'] for i in range(5)]
scores = [d[0] for d in init_data]
xs = [d[1] for d in init_data]
ys = [d[2] for d in init_data]
cs = [tab10(i) for i in range(5)]
"""

    n = 100000
    old_time = timeit.timeit(old_code, setup=setup_code, number=n)
    new_time_listcomp = timeit.timeit(new_code_listcomp, setup=setup_code, number=n)

    print(f"Old outer initialization: {old_time:.5f}")
    print(f"Listcomp initialization: {new_time_listcomp:.5f} ({old_time/new_time_listcomp:.2f}x faster)")

if __name__ == "__main__":
    benchmark()
