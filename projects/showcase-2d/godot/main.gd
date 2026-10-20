# The stick fight as a 2D fighting game: the shared choreography (fight.json)
# drives the poses; Godot adds the game layer around it: HUD health bars with a
# lagging damage chip, GPU particles, HDR glow, hit-flash, shake, zoom punch and
# a parallax arena. Everything is a function of the frame number, so Movie Maker
# records the same frames on every run.
#   godot --path . --write-movie renders/frames/f.png --fixed-fps 60 --quit-after 270
extends Node2D

const FPS := 60.0
var F: Dictionary
var PX: float
var GY: float
var frame := 0
var t := 0.0

var fighters: Node2D
var fx: Node2D
var cam: Camera2D
var sparks: Array[GPUParticles2D] = []
var dusts: Array[GPUParticles2D] = []
var hits: Array = []
var trails: Array = []
var dust_events: Array = []
var ko_event: Dictionary

var hp_fill: Dictionary = {}
var hp_chip: Dictionary = {}
var timer_label: Label
var banner: Label
var flash: ColorRect

const COL := {
	"blue": {"front": Color(0.31, 0.55, 1.0), "back": Color(0.18, 0.34, 0.72)},
	"red": {"front": Color(1.0, 0.35, 0.37), "back": Color(0.70, 0.20, 0.22)},
}
const BAR_W := 640.0


func _ready() -> void:
	F = JSON.parse_string(FileAccess.get_file_as_string("res://fight.json"))
	PX = F["view"]["px_per_unit"]
	GY = F["view"]["ground_below_center_px"]
	for e in F["events"]:
		match e["type"]:
			"hit": hits.append(e)
			"trail": trails.append(e)
			"dust": dust_events.append(e)
			"ko": ko_event = e
	build_world()
	build_hud()
	print("FIGHT2D renderer=", RenderingServer.get_video_adapter_name())


# ---------------------------------------------------------------- sampler (port of fight.py)

func ease_k(kind: String, u: float) -> float:
	match kind:
		"linear": return u
		"in": return u * u
		"out": return 1.0 - (1.0 - u) * (1.0 - u)
		"hold": return 0.0
	return 4.0 * u * u * u if u < 0.5 else 1.0 - pow(-2.0 * u + 2.0, 3) / 2.0


func resolve(k: Dictionary) -> Dictionary:
	var p: Dictionary = F["poses"][k["pose"]]
	return {"x": k["x"], "y": k.get("y", p["y"]), "rot": k.get("rot", 0.0), "torso": p["torso"],
		"hf": Vector2(p["hf"][0], p["hf"][1]), "hb": Vector2(p["hb"][0], p["hb"][1]),
		"ff": Vector2(p["ff"][0], p["ff"][1]), "fb": Vector2(p["fb"][0], p["fb"][1])}


func sample(fname: String, at: float) -> Dictionary:
	var keys: Array = F["fighters"][fname]["keys"]
	if at <= keys[0]["t"]:
		return resolve(keys[0])
	for i in keys.size() - 1:
		var k0: Dictionary = keys[i]
		var k1: Dictionary = keys[i + 1]
		if at < k1["t"]:
			var u := ease_k(k1["ease"], (at - k0["t"]) / (k1["t"] - k0["t"]))
			var a := resolve(k0)
			var b := resolve(k1)
			var out := {}
			for f in a:
				out[f] = lerp(a[f], b[f], u)
			return out
	return resolve(keys[-1])


func ik(base: Vector2, target: Vector2, l1: float, l2: float, bend: float) -> Array:
	var d := target - base
	var dist := clampf(d.length(), 1e-4, l1 + l2 - 1e-4)
	var a := atan2(d.y, d.x)
	var c := clampf((l1 * l1 + dist * dist - l2 * l2) / (2.0 * l1 * dist), -1.0, 1.0)
	var j := a + bend * acos(c)
	return [base + Vector2(cos(j), sin(j)) * l1, base + Vector2(cos(a), sin(a)) * dist]


## World-space joints (fight units, y up).
func skeleton(fname: String, at: float) -> Dictionary:
	var b: Dictionary = F["bones"]
	var s := sample(fname, at)
	var facing: float = F["fighters"][fname]["facing"]
	var tr := deg_to_rad(s["torso"])
	var up := Vector2(sin(tr), cos(tr))
	var neck: Vector2 = up * float(b["torso"])
	var pts := {"hip": Vector2.ZERO, "neck": neck, "head": neck + up * float(b["neck"])}
	for side in ["f", "b"]:
		var arm := ik(neck, neck + s["h" + side], b["upper_arm"], b["forearm"], -1)
		pts["elbow_" + side] = arm[0]
		pts["hand_" + side] = arm[1]
		var leg := ik(Vector2.ZERO, s["f" + side], b["thigh"], b["shin"], 1)
		pts["knee_" + side] = leg[0]
		pts["foot_" + side] = leg[1]
	var r := deg_to_rad(s["rot"])
	var out := {}
	for k in pts:
		var p: Vector2 = pts[k].rotated(r)
		out[k] = Vector2(s["x"] + facing * p.x, s["y"] + p.y)
	return out


func cam_x(at: float) -> float:
	var pan: Array = F["view"]["pan"]
	if at <= pan[0][0]:
		return pan[0][1]
	for i in pan.size() - 1:
		if at < pan[i + 1][0]:
			return lerpf(pan[i][1], pan[i + 1][1], ease_k("inout", (at - pan[i][0]) / (pan[i + 1][0] - pan[i][0])))
	return pan[-1][1]


## Fight units to world pixels: ground at y = 0, y down.
func px(p: Vector2) -> Vector2:
	return Vector2(p.x * PX, -p.y * PX)


func limb_at(by: String, limb: String, at: float) -> Vector2:
	var joint: String = {"hf": "hand_f", "hb": "hand_b", "ff": "foot_f", "fb": "foot_b"}[limb]
	return skeleton(by, at)[joint]


# ---------------------------------------------------------------- scene

func build_world() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_CANVAS
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_bloom = 0.0
	env.glow_hdr_threshold = 1.0
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SCREEN
	for level in [4, 5, 6]:          # the widest blur levels turn a bright impact into a full-screen haze
		env.set_glow_level(level, 0.0)
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	# sky: a fixed gradient behind everything
	var sky_layer := CanvasLayer.new()
	sky_layer.layer = -10
	add_child(sky_layer)
	var grad := Gradient.new()
	grad.set_color(0, Color(0.05, 0.04, 0.12))
	grad.set_color(1, Color(0.30, 0.10, 0.28))
	var gt := GradientTexture2D.new()
	gt.gradient = grad
	gt.fill_from = Vector2(0, 0)
	gt.fill_to = Vector2(0, 1)
	var sky := TextureRect.new()
	sky.texture = gt
	sky.size = Vector2(1920, 1080)
	sky_layer.add_child(sky)

	# far: city skyline, scrolls at 0.25 of the camera
	var far := Parallax2D.new()
	far.scroll_scale = Vector2(0.25, 1.0)
	add_child(far)
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var x := -2600.0
	while x < 3600.0:
		var w := rng.randf_range(90, 220)
		var h := rng.randf_range(160, 520)
		var b := Polygon2D.new()
		b.polygon = PackedVector2Array([Vector2(x, -60), Vector2(x, -60 - h), Vector2(x + w, -60 - h), Vector2(x + w, -60)])
		b.color = Color(0.11, 0.07, 0.20)
		far.add_child(b)
		for wy in range(int(h / 46.0) - 1):     # lit windows glow through HDR
			for wx in range(int(w / 40.0)):
				if rng.randf() < 0.28:
					var win := Polygon2D.new()
					var p0 := Vector2(x + 14 + wx * 40, -60 - h + 24 + wy * 46)
					win.polygon = PackedVector2Array([p0, p0 + Vector2(14, 0), p0 + Vector2(14, 18), p0 + Vector2(0, 18)])
					win.color = Color(1.6, 1.1, 0.5) if rng.randf() < 0.5 else Color(0.5, 0.9, 1.6)
					far.add_child(win)
		x += w + rng.randf_range(10, 60)

	# near: crowd barrier, scrolls at 0.6
	var near := Parallax2D.new()
	near.scroll_scale = Vector2(0.6, 1.0)
	add_child(near)
	var fence := Polygon2D.new()
	fence.polygon = PackedVector2Array([Vector2(-3000, -20), Vector2(-3000, -150), Vector2(4500, -150), Vector2(4500, -20)])
	fence.color = Color(0.16, 0.09, 0.24)
	near.add_child(fence)
	for i in 70:
		var head := Polygon2D.new()
		var c := Vector2(-2900 + i * 105 + rng.randf_range(-20, 20), -150 - rng.randf_range(0, 22))
		var pts := PackedVector2Array()
		for k in 16:
			pts.append(c + Vector2(cos(k / 16.0 * TAU), sin(k / 16.0 * TAU)) * 34)
		head.polygon = pts
		head.color = Color(0.22, 0.12, 0.32)
		near.add_child(head)
	var rail := Line2D.new()
	rail.points = PackedVector2Array([Vector2(-3000, -150), Vector2(4500, -150)])
	rail.width = 3
	rail.default_color = Color(1.3, 0.45, 1.0)   # neon rail, a faint glow
	near.add_child(rail)

	# floor
	var ground := Polygon2D.new()
	ground.polygon = PackedVector2Array([Vector2(-3000, 0), Vector2(4500, 0), Vector2(4500, 900), Vector2(-3000, 900)])
	ground.color = Color(0.07, 0.05, 0.11)
	add_child(ground)
	var edge := Line2D.new()
	edge.points = PackedVector2Array([Vector2(-3000, 0), Vector2(4500, 0)])
	edge.width = 5
	edge.default_color = Color(0.9, 0.55, 1.6)
	add_child(edge)

	fighters = Node2D.new()
	fighters.draw.connect(draw_fighters)
	add_child(fighters)

	# particles: a soft round texture, HDR colour ramp so sparks bloom
	var dot_grad := Gradient.new()
	dot_grad.set_color(0, Color(1, 1, 1, 1))
	dot_grad.set_color(1, Color(1, 1, 1, 0))
	var dot := GradientTexture2D.new()
	dot.gradient = dot_grad
	dot.fill = GradientTexture2D.FILL_RADIAL
	dot.fill_from = Vector2(0.5, 0.5)
	dot.fill_to = Vector2(0.5, 0.0)
	dot.width = 32
	dot.height = 32
	var spark_ramp := Gradient.new()
	spark_ramp.set_color(0, Color(4.0, 3.2, 1.4, 1))
	spark_ramp.set_color(1, Color(2.4, 0.8, 0.2, 0))
	var spark_ramp_tex := GradientTexture1D.new()
	spark_ramp_tex.gradient = spark_ramp
	for i in hits.size():
		var pm := ParticleProcessMaterial.new()
		pm.particle_flag_disable_z = true
		pm.direction = Vector3(-1 if i == 0 else 1, -1, 0)
		pm.spread = 70.0 if i == 0 else 110.0
		pm.initial_velocity_min = 500.0
		pm.initial_velocity_max = 1300.0 * hits[i]["power"]
		pm.gravity = Vector3(0, 1800, 0)
		pm.damping_min = 300.0
		pm.damping_max = 600.0
		pm.scale_min = 0.35
		pm.scale_max = 0.9
		pm.color_ramp = spark_ramp_tex
		var p := GPUParticles2D.new()
		p.texture = dot
		p.amount = 40 if i == 0 else 110
		p.lifetime = 0.35 if i == 0 else 0.5
		p.one_shot = true
		p.explosiveness = 1.0
		p.fixed_fps = 60
		p.local_coords = false
		p.use_fixed_seed = true
		p.seed = 11 + i
		p.process_material = pm
		p.emitting = false
		p.position = px(limb_at(hits[i]["by"], hits[i]["limb"], hits[i]["t"]))
		add_child(p)
		sparks.append(p)

	var dust_ramp := Gradient.new()
	dust_ramp.set_color(0, Color(0.75, 0.65, 0.9, 0.55))
	dust_ramp.set_color(1, Color(0.5, 0.4, 0.7, 0.0))
	var dust_ramp_tex := GradientTexture1D.new()
	dust_ramp_tex.gradient = dust_ramp
	for i in dust_events.size():
		var e: Dictionary = dust_events[i]
		var pm := ParticleProcessMaterial.new()
		pm.particle_flag_disable_z = true
		pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
		pm.emission_box_extents = Vector3(90, 4, 1)
		pm.direction = Vector3(0, -1, 0)
		pm.spread = 80.0
		pm.initial_velocity_min = 120.0
		pm.initial_velocity_max = 380.0 * e["power"]
		pm.gravity = Vector3(0, 60, 0)
		pm.damping_min = 200.0
		pm.damping_max = 320.0
		pm.scale_min = 2.0
		pm.scale_max = 4.0 * e["power"]
		pm.color_ramp = dust_ramp_tex
		var p := GPUParticles2D.new()
		p.texture = dot
		p.amount = 36
		p.lifetime = 0.9
		p.one_shot = true
		p.explosiveness = 0.9
		p.fixed_fps = 60
		p.local_coords = false
		p.use_fixed_seed = true
		p.seed = 31 + i
		p.process_material = pm
		p.emitting = false
		p.position = Vector2(skeleton(e["on"], e["t"])["hip"].x * PX, -6)
		add_child(p)
		dusts.append(p)

	fx = Node2D.new()
	fx.draw.connect(draw_fx)
	add_child(fx)

	cam = Camera2D.new()
	add_child(cam)
	cam.make_current()


func label(text: String, size: int, weight: int, color: Color, outline: int = 0) -> Label:
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Noto Sans"])
	font.font_weight = weight
	var ls := LabelSettings.new()
	ls.font = font
	ls.font_size = size
	ls.font_color = color
	ls.outline_size = outline
	ls.outline_color = Color(0.05, 0.03, 0.08)
	var l := Label.new()
	l.text = text
	l.label_settings = ls
	return l


func build_hud() -> void:
	var hud := CanvasLayer.new()
	hud.layer = 10
	add_child(hud)
	flash = ColorRect.new()
	flash.size = Vector2(1920, 1080)
	flash.color = Color(1, 1, 1, 0)
	hud.add_child(flash)
	for side in ["blue", "red"]:
		var left: bool = side == "blue"
		var x0: float = 80.0 if left else 1920.0 - 80.0 - BAR_W
		var frame_rect := ColorRect.new()
		frame_rect.position = Vector2(x0 - 6, 54)
		frame_rect.size = Vector2(BAR_W + 12, 52)
		frame_rect.color = Color(0.05, 0.03, 0.08)
		hud.add_child(frame_rect)
		var back := ColorRect.new()
		back.position = Vector2(x0, 60)
		back.size = Vector2(BAR_W, 40)
		back.color = Color(0.25, 0.08, 0.10)
		hud.add_child(back)
		var chip := ColorRect.new()
		chip.position = back.position
		chip.size = back.size
		chip.color = Color(1.0, 0.86, 0.55)
		hud.add_child(chip)
		var fill := ColorRect.new()
		fill.position = back.position
		fill.size = back.size
		fill.color = COL[side]["front"]
		hud.add_child(fill)
		var shine := ColorRect.new()
		shine.size = Vector2(BAR_W, 12)
		shine.position = Vector2(0, 4)
		shine.color = Color(1, 1, 1, 0.22)
		shine.mouse_filter = Control.MOUSE_FILTER_IGNORE
		fill.add_child(shine)
		fill.clip_contents = true
		hp_fill[side] = fill
		hp_chip[side] = chip
		var tag := label(side.to_upper(), 34, 900, Color(1, 1, 1), 10)
		tag.position = Vector2(x0 if left else x0 + BAR_W - 110, 108)
		hud.add_child(tag)
	timer_label = label("99", 64, 900, Color(1.0, 0.85, 0.3), 12)
	timer_label.position = Vector2(960 - 38, 40)
	hud.add_child(timer_label)
	banner = label("", 200, 900, Color(1.0, 0.85, 0.3), 30)
	banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	banner.size = Vector2(1920, 300)
	banner.position = Vector2(0, 110)
	banner.pivot_offset = Vector2(960, 150)
	hud.add_child(banner)


# ---------------------------------------------------------------- per frame

func _process(_delta: float) -> void:
	t = frame / FPS
	for i in hits.size():
		if frame == int(round(hits[i]["t"] * FPS)):
			sparks[i].restart()
			sparks[i].emitting = true
	for i in dust_events.size():
		if frame == int(round(dust_events[i]["t"] * FPS)):
			dusts[i].restart()
			dusts[i].emitting = true
	update_camera()
	update_hud()
	fighters.queue_redraw()
	fx.queue_redraw()
	frame += 1


func window01(t0: float, length: float) -> float:
	return -1.0 if t < t0 or t > t0 + length else (t - t0) / length


func update_camera() -> void:
	var a := 0.0
	for e in hits:
		var u := window01(e["t"], 0.4)
		if u >= 0.0:
			a = maxf(a, 0.09 * e["power"] * PX * (1.0 - u))
	var rng := RandomNumberGenerator.new()
	rng.seed = 1000 + frame
	var shake := Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1)) * a
	# zoom punch on the big hit, held through its hit-stop
	var big: Dictionary = hits[-1]
	var z := 0.0
	var stop_end: float = big["t"] + big["stop"]
	if t >= big["t"] and t < stop_end:
		z = minf(1.0, (t - big["t"]) / 0.05)
	elif t >= stop_end:
		z = 1.0 - minf(1.0, (t - stop_end) / 0.45)
		z = z * z
	cam.zoom = Vector2.ONE * (1.0 + 0.14 * z)
	cam.position = Vector2(cam_x(t) * PX, -GY) + shake


func hp(side: String, at: float) -> float:
	# Red takes chip damage through the block, then the uppercut empties the bar
	if side == "blue":
		return 1.0
	var v := 1.0
	if at >= hits[0]["t"]:
		v = 0.9
	if at >= hits[1]["t"]:
		v = 0.0
	return v


func update_hud() -> void:
	for side in ["blue", "red"]:
		var now := hp(side, t)
		var lag := hp(side, t - 0.45)
		var chip_v := lerpf(lag, now, clampf((t - last_change(side) - 0.3) / 0.35, 0.0, 1.0))
		var left: bool = side == "blue"
		var x0: float = 80.0 if left else 1920.0 - 80.0 - BAR_W
		set_bar(hp_fill[side], x0, now, left)
		set_bar(hp_chip[side], x0, maxf(now, chip_v), left)
		var since := t - last_change(side)
		hp_fill[side].modulate = Color(1.8, 1.8, 1.8) if since >= 0.0 and since < 0.07 else Color(1, 1, 1)
	timer_label.text = str(99 - int(t))
	# announcer banner: FIGHT! at the start, K.O. after the knockdown
	var ko_t: float = ko_event["t"]
	if t < 0.6:
		banner.text = "FIGHT!"
		var u := clampf((t - 0.05) / 0.14, 0.0, 1.0)
		banner.scale = Vector2.ONE * (1.0 + 0.8 * (1.0 - u) * (1.0 - u))
		banner.modulate.a = 0.0 if t < 0.05 else 1.0 - clampf((t - 0.46) / 0.12, 0.0, 1.0)
	elif t >= ko_t:
		banner.text = "K.O."
		var u := clampf((t - ko_t) / 0.3, 0.0, 1.0)
		var back := 1.70158
		var s := 1.0 + (back + 1.0) * pow(u - 1.0, 3) + back * pow(u - 1.0, 2)
		banner.scale = Vector2.ONE * s * 1.3
		banner.modulate = Color(1.6, 1.3, 1.0, 1.0)
	else:
		banner.text = ""
	var big: Dictionary = hits[-1]
	var fu := window01(big["t"], 0.1)
	# hdr_2d blends in linear light: a small alpha already reads as a strong flash
	flash.color.a = 0.0 if fu < 0.0 else 0.1 * (1.0 - fu) * (1.0 - fu)


func last_change(side: String) -> float:
	var last := -10.0
	if side == "red":
		for e in hits:
			if t >= e["t"]:
				last = e["t"]
	return last


func set_bar(bar: ColorRect, x0: float, v: float, left: bool) -> void:
	bar.size.x = BAR_W * v
	bar.position.x = x0 + BAR_W - bar.size.x if left else x0
	# bars drain toward the centre of the screen, as in fighting games


func draw_fighters() -> void:
	for fname in ["red", "blue"]:
		var j := skeleton(fname, t)
		# ground shadow shrinks as the body rises
		var h: float = maxf(0.0, j["hip"].y - 0.4)
		var w: float = maxf(0.25, 0.75 - 0.25 * h) * PX
		var sh := PackedVector2Array()
		for k in 24:
			sh.append(Vector2(j["hip"].x * PX + cos(k / 24.0 * TAU) * w, 4 + sin(k / 24.0 * TAU) * 14))
		fighters.draw_colored_polygon(sh, Color(0, 0, 0, 0.45))
	for e in trails:
		if t >= e["t"] and t <= e["until"] + 0.06:
			var end: float = minf(t, e["until"])
			var pts := PackedVector2Array()
			for k in 8:
				pts.append(px(limb_at(e["by"], e["limb"], maxf(e["t"], end - k * 0.02))))
			var fade := 1.0 - clampf((t - e["until"]) / 0.06, 0.0, 1.0)
			var c: Color = COL[e["by"]]["front"] * 1.8
			c.a = 0.35 * fade
			fighters.draw_polyline(pts, c, 30.0, true)
	for fname in ["red", "blue"]:
		var j := skeleton(fname, t)
		var struck := false
		if fname == "red":
			for e in hits:
				if t >= e["t"] and t < e["t"] + 0.06:
					struck = true
		for s in [["back", ["neck", "elbow_b", "hand_b"]], ["back", ["hip", "knee_b", "foot_b"]], ["body", ["hip", "neck"]],
				["front", ["hip", "knee_f", "foot_f"]], ["front", ["neck", "elbow_f", "hand_f"]]]:
			var c: Color = COL[fname]["back" if s[0] == "back" else "front"]
			if struck:
				c = Color(1.5, 1.5, 1.5)             # hit-flash: slightly overbright white, a soft bloom
			var width := 15.0 if s[0] == "back" else 19.0
			var pts := PackedVector2Array()
			for n in s[1]:
				pts.append(px(j[n]))
			fighters.draw_polyline(pts, c, width, true)
			for p in pts:                            # round joints and caps
				fighters.draw_circle(p, width / 2.0, c)
		var hc: Color = Color(1.5, 1.5, 1.5) if struck else COL[fname]["front"]
		fighters.draw_circle(px(j["head"]), F["bones"]["head"] * PX, hc)


func draw_fx() -> void:
	for e in hits:
		var u := window01(e["t"], 0.3)
		if u < 0.0:
			continue
		var c := px(limb_at(e["by"], e["limb"], e["t"]))
		var p: float = e["power"]
		var core := 70.0 * p * (1.0 - u)
		fx.draw_circle(c, core, Color(3.5, 2.8, 1.4, 1.0 - u))
		var r := 60.0 + 380.0 * p * (1.0 - pow(1.0 - u, 3))
		fx.draw_arc(c, r, 0, TAU, 64, Color(2.5, 2.2, 3.0, 1.0 - u), 10.0 * (1.0 - u) + 1.0, true)
		for i in 10:
			var a := i / 10.0 * TAU + 0.3
			var r0 := 90.0 * p + 200.0 * p * u
			var r1 := r0 + 140.0 * p * (1.0 - u)
			fx.draw_line(c + Vector2(cos(a), sin(a)) * r0, c + Vector2(cos(a), sin(a)) * r1, Color(3.0, 2.6, 1.6, 1.0 - u), 8.0, true)
