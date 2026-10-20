# Probe: can a script build and render Grease Pencil strokes headless in Blender 5.x?
import bpy, math, os
bpy.ops.wm.read_factory_settings(use_empty=True)
s = bpy.context.scene
s.render.resolution_x, s.render.resolution_y = 960, 540
s.render.engine = 'BLENDER_EEVEE'
print("DATA", [n for n in dir(bpy.data) if 'grease' in n])
gpd = bpy.data.grease_pencils.new("ink")
obj = bpy.data.objects.new("ink", gpd)
s.collection.objects.link(obj)
mat = bpy.data.materials.new("black")
bpy.data.materials.create_gpencil_data(mat)
mat.grease_pencil.color = (0.05, 0.05, 0.08, 1)
gpd.materials.append(mat)
layer = gpd.layers.new("figure")

def figure(arm):  # a stick figure in the XZ plane; arm = raised-arm angle
    head = [(0.35 * math.cos(a), 0, 2.2 + 0.35 * math.sin(a)) for a in [i / 24 * math.tau for i in range(25)]]
    body = [(0, 0, 1.85), (0, 0, 0.9)]
    legs = [(-0.45, 0, 0), (0, 0, 0.9), (0.45, 0, 0)]
    arms = [(-0.6 * math.cos(arm), 0, 1.6 - 0.6 * math.sin(arm)), (0, 0, 1.6), (0.6 * math.cos(arm), 0, 1.6 + 0.6 * math.sin(arm))]
    return [head, body, legs, arms]

for f, arm in ((1, -0.6), (12, 0.9)):
    d = layer.frames.new(f).drawing
    strokes = figure(arm)
    d.add_strokes([len(p) for p in strokes])
    for st, pts in zip(d.strokes, strokes):
        for pt, co in zip(st.points, pts):
            pt.position, pt.radius = co, 0.04
print("FRAMES", [fr.frame_number for fr in layer.frames], "STROKES", len(layer.frames[0].drawing.strokes))

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
s.collection.objects.link(cam)
cam.location, cam.rotation_euler = (0, -7, 1.3), (math.pi / 2, 0, 0)
s.camera = cam
w = bpy.data.worlds.new("w"); s.world = w
w.color = (0.95, 0.93, 0.88)
s.frame_set(12)
s.render.filepath = os.path.abspath("gp_####.png")
bpy.ops.render.render(write_still=True)
