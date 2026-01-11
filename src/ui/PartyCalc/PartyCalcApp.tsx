import React, { useState, useMemo, useCallback } from 'react';
import { Box, Typography, Button, Paper, Snackbar } from '@mui/material';
import PokemonIv from '../../util/PokemonIv';
import PokemonStrength, { createStrengthParameter} from '../../util/PokemonStrength';
import PartyMemberSlot from './PartyMemberSlot';
import TeamSummary from './TeamSummary';
import { getInitialIvState, IvAction} from '../IvCalc/IvState';
import StrengthParameterForm from '../IvCalc/Strength/StrengthParameterForm';
// import EnergyDialog from '../IvCalc/Strength/EnergyDialog';
import { getSkillValue } from '../../util/MainSkill'
import BoxItemDialog from '../IvCalc/Box/BoxItemDialog';
import { PokemonBoxItem } from '../../util/PokemonBox';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { IconButton } from '@mui/material';
import StrengthBerryIngSkillView  from '../IvCalc/Strength/StrengthBerryIngSkillView';
import PokemonBox from '../../util/PokemonBox';
import BoxView from '../IvCalc/Box/BoxView';
import StrengthParameterSummary from '../IvCalc/Strength/StrengthParameterSummary';
import IvState from '../IvCalc/IvState';
import LowerTabHeader from '../IvCalc/LowerTabHeader';
import IvForm from '../IvCalc/IvForm/IvForm';
import BoxExportDialog from '../IvCalc/Box/BoxExportDialog';
import BoxImportDialog from '../IvCalc/Box/BoxImportDialog';
import BoxDeleteAllDialog from '../IvCalc/Box/BoxDeleteAllDialog';
import { useTranslation } from 'react-i18next';

const defaultIV = getInitialIvState().pokemonIv.changeLevel(1);

export default function PartyCalcApp() {
  const { t } = useTranslation();
  // 1. パーティ全体のデータを管理 (5セット分)
  const [allTeams, setAllTeams] = useState<(string | null)[][]>(() => {
    const saved = localStorage.getItem('PstPartySelectionGroups');
    try {
      // 5セット分の配列を初期化
      return saved ? JSON.parse(saved) : Array(5).fill(null).map(() => [null, null, null, null, null]);
    } catch {
      return Array(5).fill(null).map(() => [null, null, null, null, null]);
    }
  });

  // 2. 現在表示中のパーティ番号 (0~4)
  const [currentTeamIndex, setCurrentTeamIndex] = useState<number>(() => {
    const savedIdx = localStorage.getItem('PstCurrentTeamIndex');
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
  const [boxItemDialogOpen, setBoxItemDialogOpen] = useState(false);
  const [strengthTabValue, setStrengthTabValue] = useState(0);
  const [teamItemViewIdx, setTeamItemViewIdx] = useState<number | null>(null);
  const [isEditBoxItem, setIsEditBoxItem] = useState<boolean>(false);
  const [editBoxItem, setEditBoxItem] = useState<PokemonBoxItem | null>(null);
  const [editBoxItemFlag, setEditBoxItemFlag] = useState<boolean>(false);

  const [state, setState] = useState<IvState>(() => ({
    ...getInitialIvState(),
    tabIndex: 1,
  }));

  function saveIvStateCache(state: IvState) {
    const selectedItem = state.box.getById(state.selectedItemId);
    const cache = {
        tabIndex: state.tabIndex,
        lowerTabIndex: state.lowerTabIndex,
        iv: state.pokemonIv.serialize(),
        selectedIv: selectedItem === null ? "" : selectedItem.iv.serialize(),
    };
    localStorage.setItem("PstIvState", JSON.stringify(cache));
  }

  const selectedIdRef = React.useRef(state.selectedItemId);
  React.useEffect(() => {
    selectedIdRef.current = state.selectedItemId;
  }, [state.selectedItemId]);


  

  // 3. データを保存する共通関数
  const saveTeams = (newAllTeams: (string | null)[][]) => {
    setAllTeams(newAllTeams);
    localStorage.setItem('PstPartySelectionGroups', JSON.stringify(newAllTeams));
  };

  // 4. パーティ切り替え
  const handleSwitchTeam = useCallback((idx: number) => {
    setCurrentTeamIndex(idx);
    localStorage.setItem('PstCurrentTeamIndex', idx.toString());

    React.startTransition(() => {
      setStrengthTabValue(0);
      setTeamItemViewIdx(null);
    });
  }, []);

  const handleClearAll = useCallback(() => {
    if (window.confirm(`パーティ ${currentTeamIndex + 1} をリセットしますか？`)) {
      const newAllTeams = [...allTeams];
      newAllTeams[currentTeamIndex] = [null, null, null, null, null];
      saveTeams(newAllTeams);
    }
  }, [allTeams, currentTeamIndex]);

  const handleStrengthTabChange = useCallback(() => {
    setStrengthTabValue(0);
    setTeamItemViewIdx(null);
  }, []); 

  const dispatch = useCallback((action: IvAction) => {
    if (action.type === "changeParameter") {
      const newParam = action.payload.parameter;
      setState(prevState => ({
        ...prevState,
        parameter: newParam,
      }));
      localStorage.setItem('PstStrenghParam', JSON.stringify(newParam));
    } else if (action.type === "openEnergyDialog") {
      setState(prevState => ({
        ...prevState,
        energyDialogOpen: true,
      }));
    } else if (action.type === "closeEnergyDialog") {
      setState(prevState => ({
        ...prevState,
        energyDialogOpen: false,
      }));
    } else if (action.type === "changeLowerTab") {
      setState(prevState => {
        const newState = {
          ...prevState,
          lowerTabIndex: action.payload.index,
        };
        saveIvStateCache(newState);
        return newState;
    });
      
    } else if (action.type === "select") {
      const id = action.payload.id;
      const fullSerial = state.box.getById(id)?.serialize() || "";
      if (!fullSerial) return;

      const selectIv = state.box.getById(id)?.iv;
      setState(prevState => {
        const newState = {
          ...prevState,
          pokemonIv: selectIv || defaultIV,
        };
        saveIvStateCache(newState);
        return newState;
      });

      const selectedId = selectedIdRef.current;
      if (selectedId === id) {
        setAllTeams(prevAllTeams => {
          const currentTeamIndex = currentIndexRef.current;
          const newAllTeams = [...prevAllTeams];
          const currentTeam = [...newAllTeams[currentTeamIndex]];
          const emptyIndex = currentTeam.findIndex(s => !s);
          
          if (emptyIndex !== -1) {
            currentTeam[emptyIndex] = fullSerial;
            newAllTeams[currentTeamIndex] = currentTeam;
            localStorage.setItem('PstPartySelectionGroups', JSON.stringify(newAllTeams));
            return newAllTeams;
          }
          return prevAllTeams;
        });
      } else {
        setState(prevState => {
          const newState = {
            ...prevState,
            selectedItemId: id,
          };
          saveIvStateCache(newState);
          return newState;
        });
      } 
    } else if (action.type === "updateIv") {
      const iv = action.payload.iv;
      setState(prevState => {
        const newState = {
          ...prevState,
          pokemonIv: iv,
        };
        saveIvStateCache(newState);
        return newState;
      });
    } else if (action.type === "edit") {
      setIsEditBoxItem(true);
      setBoxItemDialogOpen(true);
      setState(prevState => {
        const newState = {
          ...prevState,
          selectedItemId: action.payload.id,
        };
        saveIvStateCache(newState);
        return newState;
      });
      setEditBoxItem(state.box.getById(action.payload.id));
    } else if (action.type === "dup") {
      const originalBoxItem = state.box.getById(action.payload.id);
      if (originalBoxItem === null || !state.box.canAdd) return;
      const addId = state.box.add(originalBoxItem.iv, originalBoxItem.nickname);
      state.box.save();
      setState(prevState => {
        const newState = {
          ...prevState,
          selectedItemId: addId,
        };
        saveIvStateCache(newState);
        return newState;
      });
    } else if (action.type === "remove") {
      if (window.confirm('ボックスから選択中のポケモンを削除しますか？')) {
        state.box.remove(action.payload.id);
        state.box.save();
      }
      setState(prevState => {
        const newState = {
          ...prevState,
          selectedItemId: -1,
        };
        saveIvStateCache(newState);
        return newState;
      });
    } else if (action.type === "editDialogClose") {
      setBoxItemDialogOpen(false);
    } else if (action.type === "addOrEditDone") {
      const value = action.payload.item;
      if (!value) return;

      const currentTeamIndex = currentIndexRef.current;
      const teamItemEditIdx = teamItemEditIdxRef.current;

      if (value.id === -1) {
        if (teamItemEditIdx !== null) {
          const fullSerial = `${value.iv.serialize()}@${value.nickname || ""}`;
          
          setAllTeams(prevAllTeams => {
            const newAllTeams = [...prevAllTeams];
            newAllTeams[currentTeamIndex][teamItemEditIdx] = fullSerial;
            localStorage.setItem('PstPartySelectionGroups', JSON.stringify(newAllTeams));
            return newAllTeams;
          });
        } else {
          dispatch({type: "addThis", payload: value});
        }
      } else {
        setEditBoxItemFlag(true);
        // 既存のボックスアイテムを編集した場合は、IDで探して更新
        const originalBoxItem = state.box.getById(value.id);
        if (!originalBoxItem) return;
        state.box.set(value.id, value.iv, value.nickname);
        state.box.save();
      }
      setTeamItemEditIdx(null);
    } else if (action.type === "add") {
      if (!state.box.canAdd) {
        alert("ボックスの上限に達しています。");
        return;
      }
      setIsEditBoxItem(false);
      setBoxItemDialogOpen(true);
    } else if (action.type === "addThis") {
      if (!state.box.canAdd) {
        alert("ボックスの上限に達しています。");
        return;
      }
      const item = action.payload;
      const addId = state.box.add(item.iv, item.nickname);
      state.box.save();

      setState(prevState => {
        const newState = {
          ...prevState,
          selectedItemId: addId,
          pokemonIv: item.iv,
        };
        saveIvStateCache(newState);
        return newState;
      });
    } else if (action.type === "export") {
      setState(prevState => ({
        ...prevState,
        boxExportDialogOpen: true,
      }));
    } else if (action.type === "exportClose") {
      setState(prevState => ({
        ...prevState,
        boxExportDialogOpen: false,
      }));
    } else if (action.type === "import") {
      if (!state.box.canAdd) {
        alert("ボックスの上限に達しています。");
        return;
      }
      setState(prevState => ({
        ...prevState,
        boxImportDialogOpen: true,
      }));
    } else if (action.type === "importClose") {
      const box = new PokemonBox(state.box.items);
      setState(prevState => ({
        ...prevState,
        box: box,
        boxImportDialogOpen: false,
      }));
    } else if (action.type === "deleteAll") {
      setState(prevState => ({
        ...prevState,
        boxDeleteAllDialogOpen: true,
      }));
    } else if (action.type === "deleteAllClose") {
      setState(prevState => ({
        ...prevState,
        boxDeleteAllDialogOpen: false,
      }));
    } else if (action.type === "restoreItem") {
      setState(prevState => {
        const selectedItem = prevState.box.getById(prevState.selectedItemId);
        if (selectedItem !== null) {
          const newState = {
            ...prevState,
            pokemonIv: selectedItem.iv,
          };
          saveIvStateCache(newState);
          return newState;
        } else {
          return prevState;
        }
      });
    } else if (action.type === "saveItem") {
      setState(prevState => {
        const nickName = prevState.box.getById(prevState.selectedItemId)?.nickname;
        const box = new PokemonBox(prevState.box.items);
        box.set(prevState.selectedItemId, prevState.pokemonIv, nickName);
        box.save();
        const newState = {...prevState, box};
        saveIvStateCache(newState);
        return newState;
      });
    } else if (action.type === "closeAlert") {
      setState(prevState => ({
        ...prevState,
        alertMessage: "",
      }));
    } else if (action.type === "showAlert") {
      const msg = action.payload.message;
      setState(prevState => ({
        ...prevState,
        alertMessage: msg,
      }));
    } else {
      console.warn(`Unknown action type: ${action.type}`);
    }
  }, [state.box]);

  const teamData = useMemo(() => {
    if (editBoxItemFlag) {
      setEditBoxItemFlag(false);
    }

    const teamSerials = allTeams[deferredTeamIndex];

    // --- 1. メンバーの復元（デシリアライズは1回だけ） ---
    const members = teamSerials.map(s => {
      if (!s) return null;
      try {
        const [serial, nickname] = s.split('@');
        const iv = PokemonIv.deserialize(serial);
        return { iv, nickname: nickname || "" };
      } catch {
        return null;
      }
    });

    // --- 2. 下準備：パーティ全体の基本情報の抽出 ---
    const validMembers = members.filter((m): m is Exclude<typeof m, null> => m !== null);
    const totalHbCount = validMembers.filter(m => m.iv.hasHelpingBonusInActiveSubSkills).length;
    
    // チーム内のタイプ重複チェック用
    const teamSpecies: Record<string, Set<string>> = {};
    validMembers.forEach(m => {
      const { type, name } = m.iv.pokemon;
      if (!teamSpecies[type]) teamSpecies[type] = new Set();
      teamSpecies[type].add(name);
    });

    // --- 3. 下準備：スキル計算に必要な「パーティ全体の基礎値」を1回だけ計算 ---
    const strengthPerHelpCalcParams = createStrengthParameter({
      ...state.parameter,
      addHelpingBonusEffect: false,
      totalFlags: [true, false, true], // 食材無効
      period: -1
    });

    // 各自の「ヘルプ1回あたりの値」をあらかじめ計算しておく
    const preCalculatedBaseStats = members.map(m => {
      if (!m) return null;
      const pokeStrength = new PokemonStrength(m.iv, strengthPerHelpCalcParams).calculate();
      return {
        berry: pokeStrength.berryTotalStrength,
        ing: pokeStrength.ingredients
      };
    });

    const teamStrengthPerHelpBerryTotal = preCalculatedBaseStats.reduce((acc, val) => acc + (val?.berry || 0), 0);

    // --- 4. 各スロットの個別計算（メインループ） ---
    return members.map((m, idx) => {
      if (!m) return null;
      const { iv, nickname } = m;

      // ヘルプボーナスの適用計算
      const isOwnerHB = iv.hasHelpingBonusInActiveSubSkills;
      const applicableHbCount = isOwnerHB ? Math.max(0, totalHbCount - 1) : totalHbCount;

      // おてつだいブースト等の計算用チーム情報
      const berryBurstTeam = members
        .filter((mm, i) => i !== idx)
        .map(mm => ({
          type: mm !== null ? mm.iv.pokemon.type : defaultIV.pokemon.type,
          level: state.parameter.level === 0 ? (mm !== null ? mm.iv.level : defaultIV.level ) : state.parameter.level
        }));

      const currentCalcParams = createStrengthParameter({
        ...state.parameter,
        addHelpingBonusEffect: false,
        helpBonusCount: Math.min(applicableHbCount, 4) as 0 | 1 | 2 | 3 | 4,
        totalFlags: [true, false, true],
        berryBurstTeam: {
          auto: false,
          members: berryBurstTeam,
          species: Math.max(teamSpecies[iv.pokemon.type]?.size || 1, 1)
        }
      });

      const pokeStrength = new PokemonStrength(iv, currentCalcParams);
      const pokeStrengthCal = pokeStrength.calculate();

      // --- 5. スキル計算（preCalculatedBaseStats を利用して再計算を回避） ---
      let skillStrength = 0;
      let skillIngTotal: Record<string, number> | null = null;

      const skillName = iv.pokemon.skill;
      if (skillName.includes("Helper Boost")) {
        const skillBaseValue = getSkillValue("Helper Boost", pokeStrength.getSkillLevel(), Math.max(teamSpecies[iv.pokemon.type].size, 1));
        const skillCount = pokeStrengthCal.skillCount;
        skillStrength = skillBaseValue * skillCount * teamStrengthPerHelpBerryTotal;
        
        skillIngTotal = {};
        preCalculatedBaseStats.forEach(stat => {
          stat?.ing.forEach(ing => {
            if (ing.name === "unknown") return;
            skillIngTotal![ing.name] = (skillIngTotal![ing.name] || 0) + (ing.count * skillBaseValue * skillCount);
          });
        });
      } else if (skillName.includes("Extra Helpful S")) {
        const ratio = pokeStrengthCal.skillValue / validMembers.length;
        skillStrength = ratio * teamStrengthPerHelpBerryTotal;
        
        skillIngTotal = {};
        preCalculatedBaseStats.forEach(stat => {
          stat?.ing.forEach(ing => {
            if (ing.name === "unknown") return;
            skillIngTotal![ing.name] = (skillIngTotal![ing.name] || 0) + (ing.count * ratio);
          });
        });
      } else if (!["Ingredient Magnet S", "Cooking Power-Up S", "Ingredient Draw S"].some(s => skillName.includes(s))) {
        skillStrength = pokeStrengthCal.skillStrength + pokeStrengthCal.skillStrength2;
      }

      // ボックスとの同期チェック
      const originalBoxItem = state.box.items.find(item => item.nickname === nickname && item.iv.pokemonName === iv.pokemonName);
      const editFlag = !originalBoxItem || !originalBoxItem.iv.isEqual(iv);
      const isReplayhed = !!originalBoxItem && !originalBoxItem.iv.isEqual(iv);

      const isEvoluved = state.parameter.evolved && !m.iv.pokemon.isFullyEvolved;

      return {
        iv,
        nickname: nickname,
        result: pokeStrengthCal,
        skillStrength,
        skillIngTotal,
        param: currentCalcParams,
        editFlag,
        isReplayhed,
        isEvoluved
      };
    });
  }, [allTeams, deferredTeamIndex, state.parameter, state.box, editBoxItemFlag]);

  // handleSelectFromBox などの更新

  const handleRemoveTeamMember = useCallback((idx: number) => {
    const newAllTeams = [...allTeams];
    const currentTeam = [...newAllTeams[currentTeamIndex]];
    currentTeam[idx] = null;
    newAllTeams[currentTeamIndex] = currentTeam;
    saveTeams(newAllTeams);
    setStrengthTabValue(0);
    setTeamItemViewIdx(prevIdx => {
      if (prevIdx === idx) return null;
      return prevIdx;
    });
  }, [allTeams, currentTeamIndex]);

  const handleEditTeamMember = useCallback((idx: number) => {
    setTeamItemEditIdx(idx);

    const editTeamMemberBoxItem = (currentTeamIndex !== null &&  teamData[idx] !== null) ? new PokemonBoxItem(
      teamData[idx].iv,
      teamData[idx].nickname,
      -1
    ) : null;

    setEditBoxItem(editTeamMemberBoxItem);
    setIsEditBoxItem(true);
    setBoxItemDialogOpen(true);
  }, [teamData, currentTeamIndex]);

  const handleSelectMemberView = useCallback((idx: number) => {
    setTeamItemViewIdx(idx);
    setStrengthTabValue(1);
  }, []);

  const onBoxItemEditDialogClose = useCallback(() => {
    dispatch({ type: "editDialogClose"});
  }, [dispatch]);

  const onBoxItemDialogChange = useCallback((value: PokemonBoxItem) => {
    dispatch({ type: "addOrEditDone", payload: { item: value }});    
  }, [dispatch]);

  const onPokemonIvChange = useCallback((iv: PokemonIv) => {
    dispatch({ type: "updateIv", payload: { iv }});
  }, [dispatch]);

  const onBoxExportDialogClose = useCallback(() => {
    dispatch({type: "exportClose"});
  }, [dispatch]);
  
  const onBoxImportDialogClose = useCallback(() => {
    dispatch({type: "importClose"});
  }, [dispatch]);

  const onBoxDeleteAllDialogClose = useCallback(() => {
    dispatch({type: "deleteAllClose"});
  }, [dispatch]);

  const onAlertMessageClose = useCallback(() => {
    dispatch({type: "closeAlert"});
  }, [dispatch]);

  const onRestoreClick = useCallback(() => {
    dispatch({type: "restoreItem"});
  }, [dispatch]);

  const onSaveClick = useCallback(() => {
    dispatch({type: "saveItem"});
  }, [dispatch]);

  const handleReplayMember = useCallback((idx: number) => {
    if (teamData[idx] === null) return;

    const originalBoxItem = state.box.items.find(item => 
      item.nickname === teamData[idx]!.nickname && 
      item.iv.pokemonName === teamData[idx]!.iv.pokemonName
    );
    if (!originalBoxItem) return;
    const fullSerial = originalBoxItem.serialize();
    allTeams[currentTeamIndex][idx] = `${fullSerial}`;
    const newAllTeams = [...allTeams];
    saveTeams(newAllTeams);
  }, [allTeams, teamData, currentTeamIndex, state.box]);

  const viewMemberIV = state.lowerTabIndex === 0 ? state.pokemonIv : ((teamItemViewIdx !== null && teamData[teamItemViewIdx] !== null) ? teamData[teamItemViewIdx].iv : defaultIV);
  const viewMemberParam = state.lowerTabIndex === 0 ? state.parameter : ((teamItemViewIdx !== null && teamData[teamItemViewIdx] !== null) ? teamData[teamItemViewIdx].param : state.parameter);
  const isSelectedItemEdited = state.selectedItemId !== -1 && state.lowerTabIndex === 0 && state.box.getById(state.selectedItemId)?.iv.isEqual(state.pokemonIv) === false;
  
  return (
    <div>
    <Box sx={{ p: 2, pb: 1 }}>
      {strengthTabValue === 0 && state.lowerTabIndex !== 0 ?(
        <TeamSummary teamData={teamData} pokemonIv={state.pokemonIv} settings={state.parameter} energyDialogOpen={state.energyDialogOpen} dispatch={dispatch} />
        ) : (
          <Paper sx={{ p: 2, bgcolor: '#fdfdfd', borderRadius: 2 }}>
            <StrengthBerryIngSkillView pokemonIv={viewMemberIV} settings={viewMemberParam} energyDialogOpen={state.energyDialogOpen} dispatch={dispatch} />
          </Paper>
        )
      }

      <Box sx={{zIndex: 100, position: 'sticky', top: 0, bgcolor: '#fdfdfd', pt: 1, pb: 0, mt: 1, borderBottom: '1px solid #ddd', display: state.lowerTabIndex !== 0 ? 'block' : 'none' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>パーティ編成 {currentTeamIndex + 1}
            <IconButton 
                size="small" 
                onClick={handleStrengthTabChange} 
                sx={{ position: 'relative', top: -2.5, left: 5, p: 0.2,  }}
              >
              <InfoOutlinedIcon sx={{ fontSize: 24, color: (strengthTabValue === 0 ? '#29ce10ff' : 'inherit')}} />
            </IconButton>
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {[0, 1, 2, 3, 4].map((idx) => (
              <Button
                key={idx}
                size="small"
                variant={currentTeamIndex === idx ? "contained" : "outlined"}
                onClick={() => handleSwitchTeam(idx)}
                sx={{ minWidth: 40, p: 0.3
                }}
              >
                {idx + 1}
              </Button>
            ))}
          </Box>
          <Button size="small" variant="text" color="error" onClick={handleClearAll}>このセットを解除</Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          {teamData.map((data, idx) => (
            <Box key={`slot-${idx}-${data?.iv || 'empty'}`} sx={{ width: '20%', minWidth: 0 }}>
              <PartyMemberSlot member={data} onRemove={() => handleRemoveTeamMember(idx)} onEdit={() => handleEditTeamMember(idx)} onView={() => handleSelectMemberView(idx)} onReplay={() => handleReplayMember(idx)} infoFlag={idx === teamItemViewIdx} />
            </Box>
          ))}
        </Box>
      </Box>

      {state.lowerTabIndex !== 2 ? (
        <Box sx={{ px: 0, pt: 1}}>
          <StrengthParameterSummary state={state} dispatch={dispatch} />
        </Box>
      ) : (<></>)}
      <LowerTabHeader state={state} dispatch={dispatch} isBoxEmpty={state.box.items.length === 0}/>
    </Box>

      <div style={{margin: '0 0.5rem 10rem 0.5rem', display: state.lowerTabIndex === 0 ? 'block' : 'none' }}>
          <IvForm pokemonIv={state.pokemonIv} onChange={onPokemonIvChange}/>
      </div>
      <div style={{display: state.lowerTabIndex === 1 ? 'block' : 'none'}}>
        <BoxView items={state.box.items} iv={state.pokemonIv} selectedId={state.selectedItemId} dispatch={dispatch} parameter={state.parameter} />
      </div>
      <div style={{ contentVisibility: 'auto' , display: state.lowerTabIndex === 2 ? 'block' : 'none' }}>
        <Box sx={{ bgcolor: '#fff', p: 1, borderRadius: 2 }}>
          <StrengthParameterForm 
            dispatch={dispatch} 
            value={state.parameter} 
            hasHelpingBonus={state.pokemonIv.hasHelpingBonusInActiveSubSkills} 
          />
        </Box>
      </div>

      <BoxItemDialog
        open={boxItemDialogOpen} boxItem={editBoxItem}
        isEdit={isEditBoxItem}
        onClose={onBoxItemEditDialogClose} onChange={onBoxItemDialogChange}
      />
      <BoxExportDialog box={state.box}
          open={state.boxExportDialogOpen} onClose={onBoxExportDialogClose}/>
      <BoxImportDialog box={state.box}
          open={state.boxImportDialogOpen} onClose={onBoxImportDialogClose}/>
      <BoxDeleteAllDialog box={state.box}
          open={state.boxDeleteAllDialogOpen} onClose={onBoxDeleteAllDialogClose}/>
      <Snackbar open={state.alertMessage !== ""} message={t(state.alertMessage)}
          autoHideDuration={2000} onClose={onAlertMessageClose}/>
      <Snackbar open={isSelectedItemEdited} message={t('pokemon in the box is edited')}
          action={<>
              <Button onClick={onRestoreClick}>{t('reset')}</Button>
              <Button onClick={onSaveClick}>{t('save')}</Button>
          </>}/>
    </div>
  );
}