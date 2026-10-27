import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
	Box,
	Button,
	IconButton,
	Paper,
	Snackbar,
	Typography,
} from "@mui/material";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import PokemonBox, { PokemonBoxItem } from "../../util/Box/PokemonBox";
import { getSkillValue } from "../../util/MainSkill";
import PokemonIv from "../../util/PokemonIv";
import PokemonStrength, {
	createStrengthParameter,
} from "../../util/PokemonStrength";
import { useAuthUser } from "../common/Hook";
import BoxDeleteAllDialog from "../IvCalc/Box/BoxDeleteAllDialog";
import BoxExportDialog from "../IvCalc/Box/BoxExportDialog";
import BoxImportDialog from "../IvCalc/Box/BoxImportDialog";
// import BoxItemDialog from "../IvCalc/Box/BoxItemDialog";
import BoxItemDrawer from "../IvCalc/Box/BoxItemDrawer";
import BoxTabChild from "../IvCalc/Box/BoxTabChild";
import IvForm from "../IvCalc/IvForm/IvForm";
import {
	getInitialIvState,
	type IvAction,
	ivStateReducer,
} from "../IvCalc/IvState";
import LowerTabHeader from "../IvCalc/LowerTabHeader";
import StrengthBerryIngSkillView from "../IvCalc/Strength/StrengthBerryIngSkillView";
import StrengthParameterForm from "../IvCalc/Strength/StrengthParameterForm";
import StrengthParameterSummary from "../IvCalc/Strength/StrengthParameterSummary";
import EditMemberDialog from "../IvCalc/Team/EditMemberDialog";
import MemberList from "../IvCalc/Team/MemberList";
import { useBoxSync } from "../IvCalc/useBoxSync";
import PartyMemberSlot from "./PartyMemberSlot";
import TeamSummary from "./TeamSummary";

const defaultIV = getInitialIvState().pokemonIv.changeLevel(1);

const initialIvState = {
	...getInitialIvState(),
	tabIndex: 1,
};
// export default function PartyCalcApp() {
const PartyCalcApp = React.memo(() => {
	const [state, dispatch] = React.useReducer(ivStateReducer, initialIvState);
	const { t } = useTranslation();
	const { user } = useAuthUser();
	const saveStatus = useBoxSync(
		state.box,
		state.boxStatus,
		state.boxReloadCount,
		user,
		dispatch,
	);

	// const selectedItem = state.box.getById(state.selectedItemId);

	// 1. パーティ全体のデータを管理 (5セット分)
	const [allTeams, setAllTeams] = useState<[string | null, boolean][][]>(() => {
		const saved = localStorage.getItem("PstPartySelectionGroups");
		try {
			// 5セット分の配列を初期化
			return saved
				? JSON.parse(saved)
				: Array(5)
						.fill(null)
						.map(() => [
							[null, false],
							[null, false],
							[null, false],
							[null, false],
							[null, false],
						]);
		} catch {
			const reset = Array(5)
				.fill(null)
				.map(() => [
					[null, false],
					[null, false],
					[null, false],
					[null, false],
					[null, false],
				]);
			localStorage.setItem("PstPartySelectionGroups", JSON.stringify(reset));
			return reset;
		}
	});

	// 2. 現在表示中のパーティ番号 (0~4)
	const [currentTeamIndex, setCurrentTeamIndex] = useState<number>(() => {
		const savedIdx = localStorage.getItem("PstCurrentTeamIndex");
		return savedIdx ? parseInt(savedIdx, 10) : 0;
	});
	const currentIndexRef = React.useRef(currentTeamIndex);
	React.useEffect(() => {
		currentIndexRef.current = currentTeamIndex;
	}, [currentTeamIndex]);
	const deferredTeamIndex = React.useDeferredValue(currentTeamIndex);

	const [teamItemEditIdx, setTeamItemEditIdx] = useState<number | null>(null);
	const teamItemEditIdxRef = React.useRef(teamItemEditIdx);
	React.useEffect(() => {
		teamItemEditIdxRef.current = teamItemEditIdx;
	}, [teamItemEditIdx]);

	// 現在のパーティを取得
	const [strengthTabValue, setStrengthTabValue] = useState(0);
	const [teamItemViewIdx, setTeamItemViewIdx] = useState<number | null>(null);
	const [editBoxItem, setEditBoxItem] = useState<PokemonBoxItem | null>(null);
	const [editBoxItemFlag, setEditBoxItemFlag] = useState<boolean>(false);

	const selectedIdRef = React.useRef(state.selectedItemId);
	React.useEffect(() => {
		selectedIdRef.current = state.selectedItemId;
	}, [state.selectedItemId]);

	// コンポーネントマウント時に最上部へスクロール
	React.useEffect(() => {
		// ブラウザのスクロール位置復元を待つために少しだけ遅延させるか、
		// あるいは即座に実行します。
		window.scrollTo(0, 0);

		// もしこれでも直らない場合は、ブラウザの自動復元を無効化する設定を併用します
		if ("scrollRestoration" in history) {
			history.scrollRestoration = "manual";
		}

		// クリーンアップ関数で戻しておく（任意）
		return () => {
			if ("scrollRestoration" in history) {
				history.scrollRestoration = "auto";
			}
		};
	}, []);

	const teamData = useMemo(() => {
		if (editBoxItemFlag) {
			setEditBoxItemFlag(false);
		}

		const teamSerials = state.teams[state.teamIndex];

		// --- 1. メンバーの復元（デシリアライズは1回だけ） ---
		const members = teamSerials.members.map((s) => {
			if (!s) return null;
			try {
				const item = s.item;
				const [serial, nickname] = item.serialize().split("@");
				const iv = PokemonIv.deserialize(serial);
				return { iv, nickname: nickname || "", dTouchFlag: s.sneakySnacking };
			} catch {
				return null;
			}
		});

		// --- 2. 下準備：パーティ全体の基本情報の抽出 ---
		const validMembers = members.filter(
			(m): m is Exclude<typeof m, null> => m !== null,
		);
		const totalHbCount = validMembers.filter(
			(m) => m.iv.hasHelpingBonusInActiveSubSkills,
		).length;

		// チーム内のタイプ重複チェック用
		const teamSpecies: Record<string, Set<string>> = {};
		validMembers.forEach((m) => {
			const { type, name } = m.iv.pokemon;
			if (!teamSpecies[type]) teamSpecies[type] = new Set();
			teamSpecies[type].add(name);
		});

		// ラティ兄妹の有無
		const hasLatias = validMembers.some((m) => m.iv.pokemon.name === "Latias");
		const hasLatios = validMembers.some((m) => m.iv.pokemon.name === "Latios");

		// --- 3. 下準備：スキル計算に必要な「パーティ全体の基礎値」を1回だけ計算 ---
		const strengthPerHelpCalcParams = createStrengthParameter({
			...state.parameter,
			addHelpingBonusEffect: false,
			totalFlags: [true, false, true], // 食材無効
			period: -1,
		});

		// 各自の「ヘルプ1回あたりの値」をあらかじめ計算しておく
		const preCalculatedBaseStats = members.map((m) => {
			if (!m) return null;
			const strength = new PokemonStrength(m.iv, strengthPerHelpCalcParams);
			const result = strength.calculate();
			return {
				name: m.nickname || t(`pokemons.${m.iv.pokemonName}`),
				strength,
				result,
				flag: m.dTouchFlag,
			};
		});

		const teamStrengthPerHelpBerryTotal = preCalculatedBaseStats
			.filter((stat) => stat !== null && !stat.flag)
			.reduce((acc, val) => acc + (val?.result?.berryTotalStrength || 0), 0);

		// --- 4. 各スロットの個別計算（メインループ） ---
		return members.map((m, idx) => {
			if (!m) return null;
			const { iv, nickname, dTouchFlag } = m;

			// ヘルプボーナスの適用計算
			const isOwnerHB = iv.hasHelpingBonusInActiveSubSkills;
			const applicableHbCount = isOwnerHB
				? Math.max(0, totalHbCount - 1)
				: totalHbCount;

			// おてつだいブースト等の計算用チーム情報
			const berryBurstTeam = members
				.filter((mm, i) => i !== idx)
				.map((mm) => ({
					type: mm !== null ? mm.iv.pokemon.type : defaultIV.pokemon.type,
					level:
						state.parameter.level === 0
							? mm !== null
								? mm.iv.level
								: defaultIV.level
							: state.parameter.level,
				}));

			const currentCalcParams = createStrengthParameter({
				...state.parameter,
				addHelpingBonusEffect: false,
				helpBonusCount: Math.min(applicableHbCount, 4) as 0 | 1 | 2 | 3 | 4,
				totalFlags: [true, false, true],
				berryBurstTeam: {
					auto: false,
					members: berryBurstTeam,
					species: Math.max(teamSpecies[iv.pokemon.type]?.size || 1, 1),
				},
				tapFrequencyAsleep: dTouchFlag ? 0 : state.parameter.tapFrequencyAsleep,
				tapFrequencyAwake: dTouchFlag ? 0 : state.parameter.tapFrequencyAwake,
				latiTwins: hasLatias && hasLatios,
			});

			const pokeStrength = new PokemonStrength(iv, currentCalcParams);
			const pokeStrengthCal = pokeStrength.calculate();

			// --- 5. スキル計算（preCalculatedBaseStats を利用して再計算を回避） ---
			let skillStrength = 0;
			let skillIngTotal: Record<string, number> | null = null;
			let skillInfo = null;

			const skillName = iv.pokemon.skill;
			if (skillName.includes("Helper Boost")) {
				const skillBaseValue = getSkillValue(
					"Helper Boost",
					pokeStrength.getSkillLevel(),
					Math.max(teamSpecies[iv.pokemon.type].size, 1),
				);
				const skillCount = pokeStrengthCal.skillCount;
				skillStrength =
					skillBaseValue * skillCount * teamStrengthPerHelpBerryTotal;

				skillIngTotal = {};
				preCalculatedBaseStats.forEach((stat) => {
					if (stat === null || stat.flag) return;
					stat?.result?.ingredients.forEach((ing) => {
						if (ing.name === "unknown") return;
						skillIngTotal![ing.name] =
							(skillIngTotal![ing.name] || 0) +
							ing.count * skillBaseValue * skillCount;
					});
				});

				skillInfo = {
					value: preCalculatedBaseStats,
					baseValue: skillBaseValue,
				};
			} else if (skillName.includes("Extra Helpful S")) {
				const ratio = pokeStrengthCal.skillValue / validMembers.length;
				skillStrength = ratio * teamStrengthPerHelpBerryTotal;

				skillIngTotal = {};
				preCalculatedBaseStats.forEach((stat) => {
					if (stat === null || stat.flag) return;
					stat?.result?.ingredients.forEach((ing) => {
						if (ing.name === "unknown") return;
						skillIngTotal![ing.name] =
							(skillIngTotal![ing.name] || 0) + ing.count * ratio;
					});
				});

				skillInfo = {
					value: preCalculatedBaseStats,
					baseValue: pokeStrengthCal.skillValuePerTrigger / validMembers.length,
				};
			} else if (skillName.includes("Energizing Cheer S (Heal Pulse)")) {
				const ratio =
					(pokeStrengthCal.skillValue2 / validMembers.length) *
					Math.min(2, validMembers.length);

				skillStrength = ratio * teamStrengthPerHelpBerryTotal;

				skillIngTotal = {};
				preCalculatedBaseStats.forEach((stat) => {
					if (stat === null || stat.flag) return;
					stat?.result?.ingredients.forEach((ing) => {
						if (ing.name === "unknown") return;
						skillIngTotal![ing.name] =
							(skillIngTotal![ing.name] || 0) + ing.count * ratio;
					});
				});

				skillInfo = {
					value: preCalculatedBaseStats,
					baseValue:
						(pokeStrengthCal.skillValuePerTrigger2 / validMembers.length) *
						Math.min(2, validMembers.length),
				};
			} else if (
				![
					"Ingredient Magnet S",
					"Cooking Power-Up S",
					"Ingredient Draw S",
					"Cooking Assist S",
				].some((s) => skillName.includes(s))
			) {
				skillStrength =
					pokeStrengthCal.skillStrength + pokeStrengthCal.skillStrength2;
			}

			// ボックスとの同期チェック
			const originalBoxItem = state.box.items.find(
				(item) =>
					item.nickname === nickname && item.iv.pokemonName === iv.pokemonName,
			);
			const editFlag = !originalBoxItem || !originalBoxItem.iv.isEqual(iv);
			const isReplayhed = !!originalBoxItem && !originalBoxItem.iv.isEqual(iv);

			const isEvoluved =
				state.parameter.evolved && !m.iv.pokemon.isFullyEvolved;

			return {
				iv,
				nickname: nickname,
				result: pokeStrengthCal,
				skillStrength,
				skillIngTotal,
				skillInfo,
				param: currentCalcParams,
				editFlag,
				isReplayhed,
				isEvoluved,
				dTouchFlag,
			};
		});
	}, [
		state.teams,
		state.teamIndex,
		state.parameter,
		state.box,
		editBoxItemFlag,
		t,
	]);

	// 共通の dispatch 関数
	const my_dispatch = useCallback(
		(action: IvAction) => {
			console.log("Dispatching action:", action);

			if (action.type === "select") {
				// ボックスから選択
				dispatch(action);
				const id = action.payload.id;
				console.log("Box", state.box);
				const fullSerial = state.box.getById(id)?.serialize() || "";
				console.log("Selected box item ID:", id, "Full serial:", fullSerial);
				if (!fullSerial) return;

				// if (selectedId === id) { // パーティ編成モードの場合
				setAllTeams((prevAllTeams) => {
					const currentTeamIndex = currentIndexRef.current;
					const newAllTeams = prevAllTeams.map((team, tIdx) => {
						if (tIdx !== currentTeamIndex) return team;
						const emptyIndex = team.findIndex((s) => !s[0]);
						if (emptyIndex !== -1) {
							return team.map((item, iIdx) => {
								if (iIdx !== emptyIndex) return item;
								return [fullSerial, false] as [string | null, boolean];
							});
						} else {
							return team;
						}
					});
					localStorage.setItem(
						"PstPartySelectionGroups",
						JSON.stringify(newAllTeams),
					);
					return newAllTeams;
				});
				// } else { // 通常選択モードの場合
				// setState(prevState => {
				//   const newState = {
				//     ...prevState,
				//     selectedItemId: id,
				//   };
				//   saveIvStateCache(newState);
				//   return newState;
				// });
				setStrengthTabValue(1);
				// }
				setTeamItemViewIdx(null);
				// } else if (action.type === "edit") {
				// 	// ボックスアイテム編集
				// 	// setIsEditBoxItem(true);
				// 	// setBoxItemDialogOpen(true);
				// 	setEditBoxItem(state.box.getById(action.payload.id));
				// 	dispatch(action);
			} else if (action.type === "addOrEditDone") {
				// ボックスアイテム編集・追加完了
				const value = action.payload.item;
				if (!value) return;

				const currentTeamIndex = currentIndexRef.current;
				const teamItemEditIdx = teamItemEditIdxRef.current;

				if (value.id === -1 && teamItemEditIdx !== null) {
					// 新規追加またはパーティ編成モードでの編集
					// 既存のパーティメンバーを編集した場合
					const fullSerial = `${value.iv.serialize()}@${value.nickname || ""}`;

					setAllTeams((prevAllTeams) => {
						const newAllTeams = prevAllTeams.map((team, tIdx) => {
							if (tIdx !== currentTeamIndex) return team;
							return team.map((item, iIdx) => {
								if (iIdx !== teamItemEditIdx) return item;
								return [fullSerial, team[iIdx][1]] as [string | null, boolean];
							});
						});
						localStorage.setItem(
							"PstPartySelectionGroups",
							JSON.stringify(newAllTeams),
						);
						return newAllTeams;
					});
				} else {
					// 通常のボックスアイテム追加
					dispatch(action);
					console.log("State after addOrEditDone action:", state);
				}
				setEditBoxItemFlag(true);
				setTeamItemEditIdx(null);
			} else {
				dispatch(action);
			}
		},
		[state],
	);

	// default handlers
	const onSelect = useCallback((id: number) => {
		// ボックスから選択
		my_dispatch({ type: "select", payload: { id } });
	}, []);

	const onEdit = useCallback((id: number) => {
		// ボックスアイテム編集
		// dispatch({ type: "edit", payload: { id } });
		// my_dispatch({ type: "edit", payload: { id } });
	}, []);

	const onBoxItemEditDialogClose = useCallback(() => {
		// ボックスアイテム編集ダイアログ閉
		// my_dispatch({ type: "editDialogClose" });
	}, []);

	const onBoxItemDialogChange = useCallback((value: PokemonBoxItem) => {
		// ボックスアイテム編集・追加完了
		my_dispatch({ type: "addOrEditDone", payload: { item: value } });
	}, []);

	const onPokemonIvChange = useCallback((iv: PokemonIv) => {
		// IV更新
		my_dispatch({ type: "updateIv", payload: { iv } });
	}, []);

	const onBoxExportDialogClose = useCallback(() => {
		// ボックスエクスポート閉
		my_dispatch({ type: "exportClose" });
	}, []);

	const onBoxImportDialogClose = useCallback(() => {
		// ボックスインポート閉
		my_dispatch({ type: "importClose" });
	}, []);

	const onBoxDeleteAllDialogClose = useCallback(() => {
		// ボックス全削除閉
		my_dispatch({ type: "deleteAllClose" });
	}, []);

	const onAlertMessageClose = useCallback(() => {
		// アラートメッセージ閉
		my_dispatch({ type: "closeAlert" });
	}, []);

	const onRestoreClick = useCallback(() => {
		// 選択中アイテムをIV状態に復元
		my_dispatch({ type: "restoreItem" });
	}, []);

	const onSaveClick = useCallback(() => {
		// 選択中アイテムにIV状態を保存
		my_dispatch({ type: "saveItem" });
	}, []);

	// PartyCalcApp: パーティ全体の管理ハンドラ
	const handleSwitchTeam = useCallback((idx: number) => {
		setCurrentTeamIndex(idx);
		localStorage.setItem("PstCurrentTeamIndex", idx.toString());

		React.startTransition(() => {
			setStrengthTabValue(0);
			setTeamItemViewIdx(null);
		});
	}, []);

	const handleClearAll = useCallback(() => {
		const currentTeamIndex = currentIndexRef.current;
		if (
			window.confirm(`パーティ ${currentTeamIndex + 1} をリセットしますか？`)
		) {
			setAllTeams((prevAllTeams) => {
				const newAllTeams = prevAllTeams.map((team, tIdx) => {
					if (tIdx !== currentTeamIndex) return team;
					return [
						[null, false],
						[null, false],
						[null, false],
						[null, false],
						[null, false],
					] as [string | null, boolean][];
				});
				localStorage.setItem(
					"PstPartySelectionGroups",
					JSON.stringify(newAllTeams),
				);
				return newAllTeams;
			});
		}
	}, []);

	const handleStrengthTabChange = useCallback(() => {
		setStrengthTabValue(0);
		setTeamItemViewIdx(null);
	}, []);

	// PartyMemberSlot: チームメンバー編集・表示・削除ハンドラ
	const handleEditTeamMember = useCallback(
		(idx: number) => {
			setTeamItemEditIdx(idx);

			const editTeamMemberBoxItem =
				currentTeamIndex !== null && teamData[idx] !== null
					? new PokemonBoxItem(teamData[idx].iv, teamData[idx].nickname)
					: null;

			// my_dispatch({
			// 	type: "edit",
			// 	payload: { id: state.box.items[0]?.id || -1 },
			// }); // ダミーIDを渡す
			setEditBoxItem(editTeamMemberBoxItem);
		},
		[teamData, currentTeamIndex],
	);

	const handleSelectMemberView = useCallback((idx: number) => {
		setTeamItemViewIdx(idx);
		setStrengthTabValue(1);
	}, []);

	const handleSwitchTouchFlag = useCallback((idx: number) => {
		if (idx === null) return;
		const currentTeamIndex = currentIndexRef.current;

		setAllTeams((prevAllTeams) => {
			const newAllTeams = prevAllTeams.map((team, tIdx) => {
				if (tIdx !== currentTeamIndex) return team;

				return team.map((member, mIdx) => {
					if (mIdx !== idx || !member) return member;
					// member[1] (flag) を反転させた新しいペアを返す
					return [member[0], !member[1]] as [string | null, boolean];
				});
			});

			// ローカルストレージへの保存
			localStorage.setItem(
				"PstPartySelectionGroups",
				JSON.stringify(newAllTeams),
			);
			return newAllTeams;
		});
	}, []);

	const handleReplayMember = useCallback(
		(idx: number) => {
			if (teamData[idx] === null) return;

			const originalBoxItem = state.box.items.find(
				(item) =>
					item.nickname === teamData[idx]!.nickname &&
					item.iv.pokemonName === teamData[idx]!.iv.pokemonName,
			);
			if (!originalBoxItem) return;
			const fullSerial = originalBoxItem.serialize();
			const currentTeamIndex = currentIndexRef.current;

			setAllTeams((prevAllTeams) => {
				const newAllTeams = prevAllTeams.map((team, tIdx) => {
					if (tIdx !== currentTeamIndex) return team;
					return team.map((member, mIdx) => {
						if (mIdx !== idx) return member;
						return [fullSerial, member[1]] as [string | null, boolean];
					});
				});
				localStorage.setItem(
					"PstPartySelectionGroups",
					JSON.stringify(newAllTeams),
				);
				return newAllTeams;
			});
		},
		[teamData, state.box],
	);

	const handleRemoveTeamMember = useCallback((idx: number) => {
		const currentTeamIndex = currentIndexRef.current;
		setAllTeams((prevAllTeams) => {
			const newAllTeams = prevAllTeams.map((team, tIdx) => {
				if (tIdx !== currentTeamIndex) return team;
				return team.map((member, mIdx) => {
					if (mIdx !== idx) return member;
					return [null, false] as [string | null, boolean];
				});
			});
			localStorage.setItem(
				"PstPartySelectionGroups",
				JSON.stringify(newAllTeams),
			);
			return newAllTeams;
		});

		setTeamItemViewIdx((prevIdx) => {
			if (prevIdx === idx) {
				setStrengthTabValue(0);
				return null;
			}
			return prevIdx;
		});
	}, []);

	const viewMemberIV =
		teamItemViewIdx !== null && teamData[teamItemViewIdx] !== null
			? teamData[teamItemViewIdx].iv
			: state.pokemonIv;
	const viewMemberParam =
		state.lowerTabIndex === 0
			? state.parameter
			: teamItemViewIdx !== null && teamData[teamItemViewIdx] !== null
				? teamData[teamItemViewIdx].param
				: state.parameter;
	const isSelectedItemEdited =
		state.selectedItemId !== -1 &&
		state.lowerTabIndex === 0 &&
		state.box.getById(state.selectedItemId)?.iv.isEqual(state.pokemonIv) ===
			false;

	return (
		<div>
			<Box sx={{ p: 2, pb: 1 }}>
				{strengthTabValue === 0 && state.lowerTabIndex !== 0 ? (
					<TeamSummary
						teamData={teamData}
						pokemonIv={state.pokemonIv}
						settings={state.parameter}
						energyDialogOpen={state.energyDialogOpen}
						dispatch={my_dispatch}
					/>
				) : (
					<Paper sx={{ p: 2, bgcolor: "#fdfdfd", borderRadius: 2 }}>
						<StrengthBerryIngSkillView
							pokemonIv={viewMemberIV}
							settings={viewMemberParam}
							energyDialogOpen={state.energyDialogOpen}
							dispatch={my_dispatch}
						/>
					</Paper>
				)}

				<Box
					sx={{
						zIndex: 100,
						position: "sticky",
						top: 0,
						bgcolor: "#fdfdfd",
						pt: 1,
						pb: 0,
						mt: 1,
						borderBottom: "1px solid #ddd",
						display: state.lowerTabIndex !== 0 ? "block" : "none",
					}}
				>
					{/* <Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							mb: 1,
						}}
					>
						
						<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
							{[0, 1, 2, 3, 4].map((idx) => (
								<Button
									key={idx}
									size="small"
									variant={currentTeamIndex === idx ? "contained" : "outlined"}
									onClick={() => handleSwitchTeam(idx)}
									sx={{ minWidth: 40, p: 0.3 }}
								>
									{idx + 1}
								</Button>
							))}
						</Box>
						<Button
							size="small"
							variant="text"
							color="error"
							onClick={handleClearAll}
						>
							このセットを解除
						</Button>
					</Box>

					<Box sx={{ display: "flex", gap: 1, mb: 1 }}>
						{teamData.map((data, idx) => (
							<Box
								key={`slot-${idx}-${data?.iv || "empty"}`}
								sx={{ width: "20%", minWidth: 0 }}
							>
								<PartyMemberSlot
									member={data}
									onRemove={() => handleRemoveTeamMember(idx)}
									onEdit={() => handleEditTeamMember(idx)}
									onView={() => handleSelectMemberView(idx)}
									onReplay={() => handleReplayMember(idx)}
									onTouch={() => handleSwitchTouchFlag(idx)}
									infoFlag={idx === teamItemViewIdx}
									dispatch={my_dispatch}
								/>
                
							</Box>
						))}
					</Box> */}

          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
							パーティ編成 {currentTeamIndex + 1}
							<IconButton
								size="small"
								onClick={handleStrengthTabChange}
								sx={{ position: "relative", top: -2.5, left: 5, p: 0.2 }}
							>
								<InfoOutlinedIcon
									sx={{
										fontSize: 24,
										color: strengthTabValue === 0 ? "#29ce10ff" : "inherit",
									}}
								/>
							</IconButton>
						</Typography>
					<MemberList state={state} dispatch={dispatch} />
				</Box>

				{state.lowerTabIndex !== 2 ? (
					<Box sx={{ px: 0, pt: 1 }}>
						<StrengthParameterSummary state={state} dispatch={my_dispatch} />
					</Box>
				) : (
					<></>
				)}

				<LowerTabHeader
					state={state}
					dispatch={my_dispatch}
					isBoxEmpty={state.box.items.length === 0}
				/>
			</Box>

			<div
				style={{
					margin: "0 0.5rem 10rem 0.5rem",
					display: state.lowerTabIndex === 0 ? "block" : "none",
				}}
			>
				<IvForm
					parameter={state.parameter}
					pokemonIv={state.pokemonIv}
					onChange={onPokemonIvChange}
					dispatch={my_dispatch}
				/>
			</div>
			<div style={{ display: state.lowerTabIndex === 1 ? "block" : "none" }}>
				{/* <BoxView 
          items={state.box.items} 
          iv={state.pokemonIv} 
          selectedId={state.selectedItemId} 
          dispatch={my_dispatch} 
          parameter={state.parameter} 
          onSelect={onSelect} 
          onEdit={onEdit}
          footerAccessory={footerAccessory}
        /> */}
				<BoxTabChild
					items={state.box.items}
					iv={state.pokemonIv}
					status={state.boxStatus}
					saveStatus={saveStatus}
					selectedId={state.selectedItemId}
					drawerPosition={state.boxDrawerPosition}
					dispatch={my_dispatch}
					parameter={state.parameter}
				/>
			</div>
			<div
				style={{
					contentVisibility: "auto",
					display: state.lowerTabIndex === 2 ? "block" : "none",
				}}
			>
				<Box sx={{ bgcolor: "#fff", p: 1, borderRadius: 2 }}>
					<StrengthParameterForm
						dispatch={my_dispatch}
						value={state.parameter}
						items={state.box.items}
						hasHelpingBonus={state.pokemonIv.hasHelpingBonusInActiveSubSkills}
					/>
				</Box>
			</div>

			{/* <BoxItemDialog
				open={state.boxItemDialogOpen}
				boxItem={editBoxItem}
				isEdit={state.boxItemDialogIsEdit}
				parameter={state.parameter}
				onClose={onBoxItemEditDialogClose}
				onChange={onBoxItemDialogChange}
				dispatch={my_dispatch}
			/> */}
			{/* <BoxItemDrawer
        open={state.boxItemDialogOpen}
        boxItem={editBoxItem}
        isEdit={state.boxItemDialogIsEdit}
        parameter={state.parameter}
        onClose={onBoxItemEditDialogClose}
        onChange={onBoxItemDialogChange}
        dispatch={my_dispatch}
        drawerPosition={state.boxDrawerPosition}
      /> */}
			<BoxExportDialog
				box={state.box}
				open={state.boxExportDialogOpen}
				onClose={onBoxExportDialogClose}
			/>
			<BoxImportDialog
				box={state.box}
				open={state.boxImportDialogOpen}
				onClose={onBoxImportDialogClose}
				dispatch={my_dispatch}
			/>
			<BoxDeleteAllDialog
				open={state.boxDeleteAllDialogOpen}
				onClose={onBoxDeleteAllDialogClose}
				dispatch={my_dispatch}
			/>
			<Snackbar
				open={state.alertMessage !== ""}
				message={t(state.alertMessage)}
				autoHideDuration={2000}
				onClose={onAlertMessageClose}
			/>
			<Snackbar
				open={isSelectedItemEdited}
				message={t("pokemon in the box is edited")}
				action={
					<>
						<Button onClick={onRestoreClick}>{t("reset")}</Button>
						<Button onClick={onSaveClick}>{t("save")}</Button>
					</>
				}
			/>
		</div>
	);
});

export default PartyCalcApp;
