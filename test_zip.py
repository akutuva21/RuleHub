data = {f'init{i}': [1.0, 2.0, 3.0] for i in range(5)}
class MockTab10:
    def __call__(self, i):
        return (0.1, 0.2, 0.3, 1.0)
tab10 = MockTab10()
init_data = [data[f'init{i}'] for i in range(5)]
print(init_data)
scores, xs, ys = map(list, zip(*init_data))
print(scores, xs, ys)
