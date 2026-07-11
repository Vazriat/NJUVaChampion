import sys
lines = open("nvc/components/NavBar.tsx", encoding="utf-8-sig").readlines()

# Update the return-null line - remove /admin from the hidden paths
for i, line in enumerate(lines):
    if '!mounted || !user ||' in line:
        old = line
        new = line.replace(', "/admin"', '').replace("'/admin'", '')
        lines[i] = new
        print("Updated line " + str(i+1) + ": " + old.strip() + " -> " + new.strip())
        break

# Find links array and add admin link
for i, line in enumerate(lines):
    if "{ href: \"/hall\"" in line or '{ href: "/hall"' in line:
        indent = " " * (len(line) - len(line.lstrip()))
        admin_link = indent + "{ href: \"/admin\", label: \"管理后台\" },\n"
        lines.insert(i, admin_link)
        print("Inserted admin link before line " + str(i+1))
        break

open("nvc/components/NavBar.tsx", "w", encoding="utf-8-sig").writelines(lines)
print("Done")
