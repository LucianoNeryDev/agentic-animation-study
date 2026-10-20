import bpy, math, os
bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene
s.render.resolution_x, s.render.resolution_y = 480, 270
s.render.engine = 'BLENDER_EEVEE'
bpy.ops.object.grease_pencil_add(type='MONKEY')
obj = bpy.context.object
gpd = obj.data
for m in gpd.materials:
    g = m.grease_pencil
    print("MAT", m.name, "stroke", g.show_stroke, "fill", g.show_fill, tuple(round(c, 2) for c in g.fill_color))
layer = gpd.layers[0] if len(gpd.layers) else None
for l in gpd.layers:
    d = l.frames[0].drawing
    print("LAYER", l.name, "strokes", len(d.strokes), "ATTRS", [a.name for a in d.attributes])
    for st in list(d.strokes)[:40]:
        if gpd.materials[st.material_index].grease_pencil.show_fill:
            print("FILLSTROKE mat", st.material_index, "cyclic", st.cyclic, "fill_opacity", st.fill_opacity, "n", len(st.points), "fill_id", st.fill_id)
            break
cam = bpy.data.objects.new("c", bpy.data.cameras.new("c")); s.collection.objects.link(cam)
cam.location = (0, -6, 0); cam.rotation_euler = (math.pi/2, 0, 0); s.camera = cam
s.render.filepath = os.path.abspath("monkey_####.png")
bpy.ops.render.render(write_still=True)
for l in gpd.layers:
    d = l.frames[0].drawing
    print("VALUES", l.name, [(st.material_index, st.fill_id, st.hide_stroke, st.cyclic) for st in list(d.strokes)[:6]])
