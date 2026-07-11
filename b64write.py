import base64,sys  
path = r'C:\Users\hyl\Desktop\NJUVaChampion\nvc\components\BracketTree.tsx'  
data = sys.stdin.buffer.read()  
open(path,'wb').write(base64.b64decode(data))  
print('ok') 
