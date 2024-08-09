from os import listdir
from os.path import join, isdir, splitext

def format(file):
    with open(file, encoding='utf-8') as f:
        data = f.read()

    edited = data.replace('\t', ' '*8)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(edited)
    print('Edited', file)

def edit_files(path):
    for i in ignore:
        if i in path:
            return

    for f in listdir(path):
        f = join(path, f)
        if isdir(f) and f not in ('.', '..'):
            edit_files(f)
        elif splitext(f)[1][1:] in ext:
            format(f)

ext = 'html css js'.split(' ')
ignore = 'node_modules'.split(' ')

edit_files('.')
input('Done.')
