import bpy, math, os
bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene
s.render.resolution_x, s.render.resolution_y = 480, 270
s.render.engine = 'BLENDER_EEVEE'
gpd = bpy.data.grease_pencils.new("g"); obj = bpy.data.objects.new("g", gpd); s.collection.objects.link(obj)
m = bpy.data.materials.new("fillmat"); bpy.data.materials.create_gpencil_data(m)
m.grease_pencil.show_fill = True
m.grease_pencil.fill_color = (0.0, 0.3, 1.0, 1.0)
m.grease_pencil.color = (0, 0, 0, 1)
gpd.materials.append(m)
print("VISIBLE", m.grease_pencil.is_fill_visible)
print("MAT", m.grease_pencil.show_fill, tuple(m.grease_pencil.fill_color), m.grease_pencil.fill_style)
layer = gpd.layers.new("l")
d = layer.frames.new(1).drawing
d.add_strokes([24, 24])
for k, st in enumerate(d.strokes):
    st.cyclic = True
    st.material_index = 0
    for i, p in enumerate(st.points):
        a = i / 24 * math.tau
        p.position = (math.cos(a) + (k * 2.5 - 1.25), math.sin(a), 0) if k == 1 else (math.cos(a) + (k * 2.5 - 1.25), 0, math.sin(a))
        p.radius = 0.03
    if k == 1:
        st.fill_id = 1
d.tag_positions_changed()
w = bpy.data.worlds.new("w"); s.world = w
if w.node_tree is None: w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
print("FILLOP", [st.fill_opacity for st in d.strokes], "FILLCOL", [tuple(st.fill_color) for st in d.strokes])
print("ATTRS", [a.name for a in d.attributes])
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c")); s.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 6; cam.location = (0, -10, 10); cam.rotation_euler = (math.pi/4, 0, 0); s.camera = cam
s.render.filepath = os.path.abspath("fill_####.png")
bpy.ops.render.render(write_still=True)
