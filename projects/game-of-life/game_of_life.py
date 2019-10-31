import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation

N = 100
M = 100
alive_p = 0.3

grid = np.random.choice([1, 0], N * M, p=[alive_p, 1 - alive_p]).reshape(N, M)

def update(data):
    global grid
    new_grid = grid.copy()
    for i in range(N):
        for j in range(M):
            n_neighbors = (grid[i, (j-1)%N] + grid[i, (j+1)%M] + 
                            grid[(i-1)%N, j] + grid[(i+1)%N, j] + 
                            grid[(i-1)%N, (j-1)%M] + grid[(i-1)%N, (j+1)%M] + 
                            grid[(i+1)%N, (j-1)%M] + grid[(i+1)%N, (j+1)%M])
            if (grid[i, j] == 1):
                if ((n_neighbors < 2) or (n_neighbors > 3)):
                    new_grid[i, j] = 0
            else:
                if (n_neighbors == 3):
                    new_grid[i, j] = 1
    print('Tick: {}, Alive: {}'.format(data, new_grid.sum()))
    mat.set_data(new_grid.astype(int))
    grid = new_grid
    return [mat]

fig, ax = plt.subplots(figsize=(10, 10))
mat = ax.matshow(grid, cmap='binary')
ani = animation.FuncAnimation(fig, update, interval=200,
                              save_count=50)
plt.show()