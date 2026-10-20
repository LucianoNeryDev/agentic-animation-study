import bpy
gpd = bpy.data.grease_pencils.new("p")
layer = gpd.layers.new("l")
d = layer.frames.new(1).drawing
d.add_strokes([3])
st = d.strokes[0]
print("STROKE", [a for a in dir(st) if not a.startswith('_')])
print("POINT", [a for a in dir(st.points[0]) if not a.startswith('_')])
print("DRAWING", [a for a in dir(d) if not a.startswith('_')])
print("LAYER", [a for a in dir(layer) if not a.startswith('_')])
m = bpy.data.materials.new("m"); bpy.data.materials.create_gpencil_data(m)
print("GPMAT", [a for a in dir(m.grease_pencil) if not a.startswith('_')])
print("FRAMES", [a for a in dir(layer.frames) if not a.startswith('_')])
