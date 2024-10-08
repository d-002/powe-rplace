import pygame
from pygame.locals import *
from math import *

W, H = 1024, 1024

pygame.init()
screen = pygame.display.set_mode((W>>1, H>>1))
clock = pygame.time.Clock()

def sqr(surf, col, center, size):
    d = size/sqrt(2)
    x, y = center
    pos = [(x, y-d), (x+d, y), (x, y+d), (x-d, y)]
    pygame.draw.polygon(surf, col, [(round(x), round(y)) for x, y in pos])
    flip()

def flip():
    screen.fill((255, 255, 255))
    screen.blit(pygame.transform.smoothscale(surf, (W>>1, H>>1)), (0, 0))
    pygame.display.flip()
    return pygame.event.get()

surf = pygame.Surface((W, H), SRCALPHA)

colors = '056 00f 068 080 7c0 aaa bbb ccc eee'.split(' ')
colors = [(int(r, 16)*17, int(g, 16)*17, int(b, 16)*17) for r, g, b in colors]
dblue, blue, cyan, green, lime, gray1, gray2, gray3, gray4 = colors

def dark(col, m=0.8):
    r, g, b = col
    return (r*m, g*m, b*m)

s = 150
r1 = 180
r2 = 120
s1 = 0
s2 = 0
s3 = -0
c = 512
sqr(surf, dark(blue), (c-0.5*s+s1, c-1.5*s-s1), r2)
sqr(surf, dark(dblue), (c-0.5*s+(s1+s2)/2, c-0.5*s-(s1+s2)/2), r2)
sqr(surf, dark(cyan), (c+0.5*s+(s1+s2)/2, c-1.5*s-(s1+s2)/2), r2)
sqr(surf, dark(green), (c+0.5*s+s2, c-0.5*s-s2), r2)
sqr(surf, dark(lime), (c+0.5*s+(s2+s3)/2, c+0.5*s-(s2+s3)/2), r2)

sqr(surf, gray1, (c-2*s+s1, c-s1), r1)
sqr(surf, dblue, (c-s+s1, c-s-s1), r1)
sqr(surf, blue, (c+s1, c-2*s-s1), r1)
sqr(surf, gray2, (c-s+s2, c+s-s2), r1)
sqr(surf, green, (c+s2, c-s2), r1)
sqr(surf, cyan, (c+s+s2, c-s-s2), r1)
sqr(surf, gray3, (c+s3, c+2*s-s3), r1)
sqr(surf, lime, (c+s+s3, c+s-s3), r1)
sqr(surf, gray4, (c+2*s+s3, c-s3), r1)

# make monochrome version
surf2 = pygame.Surface((W, H), SRCALPHA)
for x in range(W):
    for y in range(H):
        r, g, b, a = surf.get_at((x, y))
        if (a and (r, g, b) not in colors): a = 127
        surf2.set_at((x, y), (255, 255, 255, a))

s = 1024
for i in range(6):
    surf_ = pygame.transform.smoothscale(surf, (s, s))
    surf2_ = pygame.transform.smoothscale(surf2, (s, s))
    pygame.image.save(surf_, 'public/img/icon/icon-%d.png' %s)
    pygame.image.save(surf2_, 'public/img/icon/icon-mono-%d.png' %s)

    s >>= 1

print('Done.')
while True:
    for e in flip():
        if e.type == QUIT:
            pygame.quit()
            exit()

    clock.tick(10)
