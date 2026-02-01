# hud_manager.gd
extends Label

@export var player_manager: Node

func _process(_delta: float) -> void:
	if not player_manager:
		return
	
	var state_machine = player_manager as PlayerStateMachine
	if not state_machine:
		return
	
	# Mostrar velocidad si está conduciendo
	if state_machine.current_state == PlayerStateMachine.State.DRIVING:
		if is_instance_valid(state_machine.current_vehicle):
			var speed = state_machine.current_vehicle.get_current_speed()
			text = "%.0f km/h" % speed
	else:
		text = "A pie"
