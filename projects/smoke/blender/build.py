import bpy
from bpy_extras import anim_utils
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, 24
scene.render.resolution_x, scene.render.resolution_y = 640, 360
print("ENGINES", [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items])
bpy.ops.mesh.primitive_cube_add(size=1)
cube = bpy.context.object
for f, x in ((1, -2.0), (24, 2.0)):
    cube.location.x = x
    cube.keyframe_insert(data_path="location", frame=f)
action = cube.animation_data.action
bag = anim_utils.action_get_channelbag_for_slot(action, cube.animation_data.action_slot)
for fc in bag.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'LINEAR'
print("FCURVES", [(fc.data_path, fc.array_index) for fc in bag.fcurves])
cam_data = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam); cam.location = (0, -8, 2); cam.rotation_euler = (1.4, 0, 0)
scene.camera = cam
light = bpy.data.objects.new("sun", bpy.data.lights.new("sun", 'SUN')); scene.collection.objects.link(light)
light.rotation_euler = (0.8, 0.2, 0.3)
world = bpy.data.worlds.new("w"); scene.world = world
bpy.ops.wm.save_as_mainfile(filepath=__import__("os").path.abspath("scene.blend"))
